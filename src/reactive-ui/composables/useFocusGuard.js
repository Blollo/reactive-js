import { onScopeDispose } from "../../core/reactive.js";

export function useFocusGuard (container) {
    let guardObserver = null;

    function getGuardTargets () {
        // ShadowRoot is not an Element — apply to each direct child element
        if (container instanceof ShadowRoot) {
            return Array.from(container.children);
        }

        return [container];
    }

    function applyGuard () {
        for (const el of getGuardTargets()) {
            el.inert = true;
        }
    }

    function removeGuard () {
        for (const el of getGuardTargets()) {
            el.inert = false;
        }
    }

    function startGuardObserver () {
        if (guardObserver) {
            return;
        }

        // only needed when the container is a ShadowRoot, because new
        // direct children won't inherit `inert` from a non-Element root.
        // for regular Element containers, `inert` propagates natively.
        if (!(container instanceof ShadowRoot)) {
            return;
        }

        guardObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        node.inert = true;
                    }
                }
            }
        });

        guardObserver.observe(container, { childList: true });
    }

    function stopGuardObserver () {
        if (guardObserver) {
            guardObserver.disconnect();
            guardObserver = null;
        }
    }

    onScopeDispose(() => {
        stopGuardObserver();
    });

    return {
        apply: applyGuard,
        remove: removeGuard,
        startObserver: startGuardObserver,
        stopObserver: stopGuardObserver,
    };
}
