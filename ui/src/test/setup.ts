// jsdom annonce `en-US` : les tests écrivent leurs attentes en français, comme l'app sur un système français.
Object.defineProperty(navigator, "language", { value: "fr-FR", configurable: true });
