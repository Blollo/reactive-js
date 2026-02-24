import { ReactiveComponent } from "../../ReactiveComponent.js";

class SegmentContent extends ReactiveComponent {
    style () {
        return /*html*/`
        <style>
            :host {
                display: block;
            }
        </style>`;
    }

    template () {
        return /*html*/`<slot></slot>`;
    }

    setup () {
        return {};
    }
}

customElements.define("hs-segment-content", SegmentContent);
