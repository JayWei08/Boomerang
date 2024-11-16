class Multiset {
   constructor(import_elements = new Map()) {
      this.elements = import_elements;
   }

   add(element) {
      if (!this.elements.has(element)) {
         this.elements.set(element, 0);
      }
      this.elements.set(element, this.elements.get(element) + 1);
   }

   add_list(elements) {
      for (const element of elements) {
         this.add(element);
      }
   }

   remove(element) {
      if (this.elements.has(element)) {
         const count = this.elements.get(element);
         this.elements.set(element, count - 1);
         if (count === 1) {
            this.elements.delete(element);
         }
      } else {
         console.log("Element not found in the multiset.");
      }
   }

   get(element) {
      return this.elements.get(element);
   }

   export() {
      return this.elements;
   }
}