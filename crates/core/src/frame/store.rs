//! Cadres de l'utilisateur. Tout fichier importé est traité comme hostile : tailles bornées,
//! seuls `frame.json` et `frame.svg` sont lus (jamais d'extraction), validation complète avant
//! copie.

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use super::{Frame, FrameError};

const MANIFEST_FILE: &str = "frame.json";
const TEMPLATE_FILE: &str = "frame.svg";

const MAX_MANIFEST_BYTES: u64 = 256 * 1024;
const MAX_TEMPLATE_BYTES: u64 = 8 * 1024 * 1024;
const MAX_ARCHIVE_BYTES: u64 = 16 * 1024 * 1024;

#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct LoadIssue {
    pub folder: String,
    pub message: String,
}

pub struct UserFrames {
    directory: PathBuf,
}

fn package_error(message: impl Into<String>) -> FrameError {
    FrameError::Package(message.into())
}

fn io_error(error: &std::io::Error) -> FrameError {
    package_error(error.to_string())
}

fn read_capped(path: &Path, limit: u64) -> Result<String, FrameError> {
    let size = fs::metadata(path).map_err(|e| io_error(&e))?.len();
    if size > limit {
        return Err(package_error(format!(
            "« {} » est trop gros ({} Mo, limite {} Mo)",
            path.display(),
            size / 1_000_000,
            limit / 1_000_000
        )));
    }
    fs::read_to_string(path).map_err(|e| io_error(&e))
}

fn read_entry(
    archive: &mut zip::ZipArchive<fs::File>,
    name: &str,
    limit: u64,
) -> Result<String, FrameError> {
    let found = (0..archive.len()).find_map(|index| {
        let file = archive.by_index(index).ok()?;
        let path = file.enclosed_name()?;
        let matches = path.file_name().is_some_and(|f| f == name) && path.components().count() <= 2;
        matches.then_some(index)
    });
    let index =
        found.ok_or_else(|| package_error(format!("« {name} » est absent de l'archive")))?;

    let file = archive
        .by_index(index)
        .map_err(|e| package_error(e.to_string()))?;
    let mut content = String::new();
    // `take` borne la lecture même si l'archive ment sur la taille décompressée.
    file.take(limit + 1)
        .read_to_string(&mut content)
        .map_err(|e| package_error(format!("« {name} » illisible : {e}")))?;
    if content.len() as u64 > limit {
        return Err(package_error(format!("« {name} » est trop gros")));
    }
    Ok(content)
}

impl UserFrames {
    pub fn new(directory: PathBuf) -> Self {
        Self { directory }
    }

    pub fn directory(&self) -> &Path {
        &self.directory
    }

    pub fn ensure_directory(&self) -> Result<(), FrameError> {
        fs::create_dir_all(&self.directory).map_err(|e| io_error(&e))
    }

    pub fn load_all(&self) -> (Vec<Frame>, Vec<LoadIssue>) {
        let mut frames = Vec::new();
        let mut issues = Vec::new();

        let Ok(entries) = fs::read_dir(&self.directory) else {
            return (frames, issues);
        };

        let mut folders: Vec<PathBuf> = entries
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.is_dir())
            .collect();
        folders.sort();

        for folder in folders {
            let name = folder
                .file_name()
                .map_or_else(String::new, |n| n.to_string_lossy().into_owned());
            match Self::read_folder(&folder) {
                Ok(frame) => frames.push(frame),
                Err(error) => issues.push(LoadIssue {
                    folder: name,
                    message: error.to_string(),
                }),
            }
        }
        (frames, issues)
    }

    fn read_folder(folder: &Path) -> Result<Frame, FrameError> {
        let manifest = read_capped(&folder.join(MANIFEST_FILE), MAX_MANIFEST_BYTES)?;
        let svg = read_capped(&folder.join(TEMPLATE_FILE), MAX_TEMPLATE_BYTES)?;
        Frame::from_sources(&manifest, svg, false)
    }

    pub fn import(&self, source: &Path) -> Result<Frame, FrameError> {
        let (manifest_json, svg) = if source.is_dir() {
            (
                read_capped(&source.join(MANIFEST_FILE), MAX_MANIFEST_BYTES)?,
                read_capped(&source.join(TEMPLATE_FILE), MAX_TEMPLATE_BYTES)?,
            )
        } else {
            let size = fs::metadata(source).map_err(|e| io_error(&e))?.len();
            if size > MAX_ARCHIVE_BYTES {
                return Err(package_error("l'archive dépasse 16 Mo"));
            }
            let file = fs::File::open(source).map_err(|e| io_error(&e))?;
            let mut archive = zip::ZipArchive::new(file)
                .map_err(|e| package_error(format!("archive illisible : {e}")))?;
            (
                read_entry(&mut archive, MANIFEST_FILE, MAX_MANIFEST_BYTES)?,
                read_entry(&mut archive, TEMPLATE_FILE, MAX_TEMPLATE_BYTES)?,
            )
        };

        let frame = Frame::from_sources(&manifest_json, svg.clone(), false)?;

        // L'identifiant a été validé (minuscules, chiffres, - et _) : il ne peut pas sortir du dossier.
        let target = self.directory.join(&frame.manifest.id);
        fs::create_dir_all(&target).map_err(|e| io_error(&e))?;
        fs::write(target.join(MANIFEST_FILE), manifest_json).map_err(|e| io_error(&e))?;
        fs::write(target.join(TEMPLATE_FILE), svg).map_err(|e| io_error(&e))?;
        Ok(frame)
    }

    pub fn remove(&self, id: &str) -> Result<(), FrameError> {
        if id.is_empty() || id.contains(['/', '\\', '.']) {
            return Err(package_error(format!("identifiant « {id} » invalide")));
        }
        let target = self.directory.join(id);
        if target.is_dir() {
            fs::remove_dir_all(target).map_err(|e| io_error(&e))?;
        }
        Ok(())
    }
}
