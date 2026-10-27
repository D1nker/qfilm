import { vi } from "vitest";

/// Un double de `@/shared/api/api` : chaque appel vers Rust devient un espion que le test pilote.
export function apiMock() {
  return {
    closeImage: vi.fn(),
    exportImage: vi.fn(),
    frameThumbnails: vi.fn(),
    importFrame: vi.fn(),
    listFrames: vi.fn(),
    listPresets: vi.fn(),
    openFramesFolder: vi.fn(),
    openImage: vi.fn(),
    pickDestination: vi.fn(),
    pickFrameArchive: vi.fn(),
    pickFrameFolder: vi.fn(),
    pickImage: vi.fn(),
    presetThumbnails: vi.fn(),
    reloadFrames: vi.fn(),
    removeFrame: vi.fn(),
    renderPreview: vi.fn(),
  };
}
