class Multiset {
    constructor(import_map = new Map()) {
        this.map = import_map;
    }

    add(element) {
        if (!this.map.has(element)) {
            this.map.set(element, 0);
        }
        this.map.set(element, this.map.get(element) + 1);
    }

    add_list(elements) {
        // Ensure elements is an array or other iterable
        if (!Array.isArray(elements)) {
            console.log("Error: elements is not an iterable.");
            return;
        }
        for (const element of elements) {
            this.add(element);
        }
    }

    remove(element) {
        if (this.map.has(element)) {
            const count = this.map.get(element);
            if (count === 1) {
                this.map.delete(element);
            } else {
                this.map.set(element, count - 1);
            }
        } else {
            console.log("Element not found in the multiset.");
        }
    }

    get(element) {
        return this.map.get(element) || 0;
    }

    export() {
        return this.map;
    }
}

module.exports = Multiset;
