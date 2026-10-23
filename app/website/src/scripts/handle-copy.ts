document.querySelectorAll<HTMLElement>(`[data-code-wrapper]`).forEach((root) => {
    // Prevent duplicate listeners if this element persists
    if (root.dataset.initialized === "true") return;
    root.dataset.initialized = "true";

    const copyButton = root.querySelector<HTMLElement>(`[data-code-copy-button]`);
    const codeTextEl = root.querySelector<HTMLElement>(`code`);
    const codeText = codeTextEl?.innerText;

    if (!codeText || !copyButton) return;


    copyButton.addEventListener("click", (event) => {
        if (!(event.target instanceof Element)) return;
        copy();
    });

    /* vv - Handles confirmation and copy animations - vv */

	const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function flashing(text: string, offset = 0): HTMLSpanElement[] {
		return [...text].map((char, index) => {
			const span = document.createElement('span');
			span.className = 'install-char';
			span.style.setProperty('--i', String(offset + index));
			span.textContent = char;
			return span;
		});
	}

    // function flashCommand() {
	// 	if (reducedMotion()) return;
	// 	if (!codeTextEl || !codeText) return;
	// 	codeTextEl.replaceChildren(...flashing(codeText));
	// }


    function replay(element: HTMLElement, className: string) {
		element.classList.remove(className);
		void element.offsetWidth;
		element.classList.add(className);
	}

    const copyTimers = new WeakMap<HTMLElement, number>();


	/** Shows a copy result on the copy cell for a moment, then returns it to rest. */
	function showResult(state: 'is-copied' | 'is-copy-failed', message: string, title: string) {
		const status = root.querySelector<HTMLElement>('[data-install-status]');
		const button = root.querySelector<HTMLButtonElement>('[data-code-copy-button]');
		if (status) status.textContent = message;
		if (button) button.title = title;
		root.classList.remove('is-copied', 'is-copy-failed');
		replay(root, state);
		window.clearTimeout(copyTimers.get(root));
		copyTimers.set(
			root,
			window.setTimeout(
				() => {
					root.classList.remove(state);
					if (status) status.textContent = '';
					if (button) button.title = 'Copy install command';
				},
				state === 'is-copied' ? 1600 : 4000,
			),
		);
	}

    const text = codeText;

    function legacyCopy(): boolean {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.opacity = '0';
        // 16px avoids the focus-driven zoom on iOS Safari.
        textarea.style.fontSize = '16px';
        document.body.appendChild(textarea);
    
        const isIOS = /ipad|iphone|ipod/i.test(navigator.userAgent);
        if (isIOS) {
            // iOS Safari ignores input.select(); it needs an explicit range.
            const range = document.createRange();
            range.selectNodeContents(textarea);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
            textarea.setSelectionRange(0, text.length);
        } else {
            textarea.select();
        }
    
        let ok = false;
        try {
            ok = document.execCommand('copy');
        } catch {
            ok = false;
        }
    
        document.body.removeChild(textarea);
        return ok;
    }

    async function copyToClipboard(): Promise<boolean> {
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch {
                // Fall through to the legacy path (mobile Safari, blocked permissions, etc.).
            }
        }
        return legacyCopy();
    }
    async function copy() {
        console.log('clicked')
		const copyResult = await copyToClipboard();
        if (copyResult) {
            // flashCommand();
            showResult('is-copied', `Copied: ${text}`, 'Copied');
        } else {
			showResult('is-copy-failed', `Couldn't copy automatically. The command is selected: press Ctrl+C or ⌘C.`, `Couldn't copy: the command is selected, press Ctrl+C or ⌘C`);
        }
	}
});