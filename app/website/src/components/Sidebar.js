const mountCodeSelector = () => {
    document.querySelectorAll<HTMLElement>("[data-code-tabs]").forEach((root) => {
        root.addEventListener("click", (event) => {
            if (!(event.target instanceof Element)) return;
            const tab = event.target.closest<HTMLButtonElement>("[data-code-tab]");
            if (!tab || !root.contains(tab)) return;
    
            const selected = tab.dataset.codeTab;
    
            root.querySelectorAll<HTMLButtonElement>("[data-code-tab]").forEach((button) => {
                button.setAttribute("aria-pressed", String(button === tab));
            });
    
            root.querySelectorAll<HTMLElement>("[data-code-panel]").forEach((panel) => {
                panel.hidden = panel.dataset.codePanel !== selected;
            });
        });
    });
}