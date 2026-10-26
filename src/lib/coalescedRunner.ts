/// Un seul rendu à la fois : les mouvements de curseur sont fusionnés plutôt que
/// mis en file, sinon l'aperçu accumulerait un retard croissant.
export function coalescedRunner(task: () => Promise<void>, onBusy?: (busy: boolean) => void) {
  let running = false;
  let queued = false;

  const run = async (): Promise<void> => {
    if (running) {
      queued = true;
      return;
    }

    running = true;
    onBusy?.(true);
    try {
      await task();
    } finally {
      running = false;
      if (queued) {
        queued = false;
        void run();
      } else {
        onBusy?.(false);
      }
    }
  };

  return run;
}
