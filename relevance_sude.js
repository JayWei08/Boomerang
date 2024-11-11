const keywords = []; //Strings to indexes

// THe keywords below this are in indexes
const user_keywords = Multiset();
const project_keywords = [];
const relevance = 0;

function get_relevanec(project_keywords, user_keywords) {
   for (const keyword of project_keywords) {
      relevance += user_keywords.get(keyword) || 0;
   }
   return relevance;
}

class Multiset {
   constructor() {
      this.elements = new Map();
   }

   add(element) {
      if (!this.elements.has(element)) {
         this.elements.set(element, 0);
      }
      this.elements.set(element, this.elements.get(element) + 1);
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
}