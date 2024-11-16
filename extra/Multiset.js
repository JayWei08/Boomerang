class Multiset {
   constructor(import_map = new Map()) {
      this.map = import_map;
   }

   add(element) {
      if (!this.elements.has(element)) {
         this.elements.set(element, 0);
      }
      this.map.set(element, this.map.get(element) + 1);
   }

   add_list(elements) {
      for (const element of elements) {
         this.add(element);
      }
   }

   remove(element) {
      if (this.map.has(element)) {
         const count = this.map.get(element);
         this.map.set(element, count - 1);
         if (count === 1) {
            this.map.delete(element);
         }
      } else {
         console.log("Element not found in the multiset.");
      }
   }

   get(element) {
      return this.map.get(element);
   }

   export() {
      return this.map;
   }
}