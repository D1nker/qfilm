// Faux pont Tauri exécuté dans la page : l'interface tourne dans un navigateur ordinaire, face à
// un Rust simulé. Les manifestes de cadres sont les vrais, fournis par `window.__MANIFESTS__`.
(() => {
  const svg = (w, h, a = "#4a6fa5", b = "#c97b4a") =>
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
    );

  const neutral = {
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    saturation: 0,
    vibrance: 0,
    temperature: 0,
    tint: 0,
    clarity: 0,
    lift: 0,
    halation: 0,
    grain: 0,
    grainSize: 2,
    vignette: 0,
  };
  const inLanguage = (text, language) => (typeof text === "string" ? text : text[language]);
  const preset = (id, name, category, params = {}) => ({
    id,
    name,
    category,
    description: {
      fr: `Description de ${inLanguage(name, "fr")}`,
      en: `Description of ${inLanguage(name, "en")}`,
    },
    params: { ...neutral, ...params },
  });
  const colorNegative = { fr: "Négatif couleur", en: "Color negative" };
  const presets = [
    preset("neutral", { fr: "Neutre", en: "Neutral" }, "Base"),
    preset("portrait", "Portrait 400", colorNegative, {
      exposure: 1,
      contrast: -0.4,
      grainSize: 4,
    }),
    preset("dore", { fr: "Doré 200", en: "Golden 200" }, colorNegative, {
      temperature: 0.5,
      saturation: 0.3,
    }),
    preset(
      "classique",
      { fr: "Classique 400", en: "Classic 400" },
      { fr: "Noir & blanc", en: "Black & white" },
      {
        saturation: -1,
        contrast: 0.5,
        grain: 0.6,
      },
    ),
  ];
  const thumbnailColors = {
    neutral: ["#4a6fa5", "#c97b4a"],
    portrait: ["#7a9a6a", "#e0b080"],
    dore: ["#c9a040", "#e07a3a"],
    classique: ["#222", "#ddd"],
  };

  const none = {
    id: "none",
    name: { fr: "Aucun", en: "None" },
    description: "",
    author: "",
    rotatePortrait: false,
    captionDefaults: {},
    params: [],
    builtin: true,
  };
  let importedFrames = [];
  const catalog = () => ({
    frames: [none, ...window.__MANIFESTS__, ...importedFrames],
    issues: window.__issues ?? [],
    directory: "/fake/frames",
  });

  const imageSize = () => window.__size ?? [1200, 800];
  const listeners = {};
  const callbacks = {};
  let callbackId = 0;

  const handlers = {
    list_presets: () => presets,
    supported_extensions: () => ["jpg", "png"],
    "plugin:dialog|open": ({ options = {} }) => {
      if (options.directory) return "/fake/my-frame-folder";
      if (options.filters?.some((f) => f.extensions?.includes("zip"))) return "/fake/my-frame.zip";
      return "/fake/IMG_0001.jpg";
    },
    "plugin:dialog|save": () => "/fake/out/IMG_0001.jpg",
    open_image: () => {
      const [w, h] = imageSize();
      return { id: "1", fileName: "IMG_0001.jpg", width: w * 3, height: h * 3, preview: svg(w, h) };
    },
    preset_thumbnails: () =>
      presets.map((p) => ({ id: p.id, image: svg(240, 160, ...thumbnailColors[p.id]) })),
    frame_thumbnails: ({ frames }) =>
      frames.map((_, i) =>
        svg(260, 180, ["#556", "#a66", "#6a8", "#222", "#333", "#468", "#864"][i % 7], "#ddd"),
      ),
    render_preview: ({ frame }) => {
      const [w, h] = window.__size ?? [1300, 900];
      const printed = frame.id.startsWith("film") && frame.params.stock !== "plain";
      return {
        image: svg(w, h),
        width: w,
        height: h,
        zones: printed
          ? [
              { field: "text", x: 100, y: 20, width: 300, height: 40 },
              { field: "frameNumber", x: 600, y: 20, width: 100, height: 40 },
            ]
          : [],
        captionCenter: [0.5, 0.9],
      };
    },
    export_image: () => null,
    close_image: () => null,
    list_frames: () => catalog(),
    reload_frames: () => catalog(),
    import_frame: ({ path }) => {
      if (String(path).includes("bad")) throw "cadre inutilisable : manifeste invalide";
      const fromFolder = String(path).includes("folder");
      const id = fromFolder ? "imported-folder" : "imported-zip";
      importedFrames = [
        ...importedFrames.filter((f) => f.id !== id),
        {
          id,
          name: fromFolder ? "Cadre dossier" : "Cadre zip",
          description: "",
          author: "",
          rotatePortrait: false,
          captionDefaults: {},
          builtin: false,
          params: [
            {
              id: "width",
              label: "Épaisseur",
              type: "number",
              min: 1,
              max: 30,
              step: 1,
              unit: "%",
              default: 5,
            },
          ],
        },
      ];
      return catalog();
    },
    remove_frame: ({ id }) => {
      importedFrames = importedFrames.filter((f) => f.id !== id);
      return catalog();
    },
    open_frames_folder: () => null,
    "plugin:event|listen": ({ event, handler }) => {
      (listeners[event] ??= []).push(handler);
      return handler;
    },
    "plugin:event|unlisten": () => null,
  };

  window.__calls = [];
  window.__emit = (event, payload) =>
    (listeners[event] ?? []).forEach((id) => callbacks[id]?.({ event, id, payload }));
  window.__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: "main" },
      currentWebview: { windowLabel: "main", label: "main" },
    },
    transformCallback: (callback) => {
      callbacks[++callbackId] = callback;
      return callbackId;
    },
    unregisterCallback: () => undefined,
    invoke: async (cmd, args) => {
      window.__calls.push({ cmd, args: JSON.parse(JSON.stringify(args ?? null)) });
      const handler = handlers[cmd];
      if (!handler) throw new Error(`mock : commande inconnue ${cmd}`);
      return handler(args ?? {});
    },
  };
})();
