// TODO IMPLEMENT IN controllers.project.js index function - intercept projects after Project.find()

// Required
const keywords = [];

// Inputs
const user_keywords = Multiset(); // What keywords the user has visited before
const project_keywords = []; // The keywords of the project
const projects = []; // All projects are in ProjectSchema - models/project.js

// have clusterMaps.js use this to get projects
function get_projects(min_relevance, required_projects) {
   const ret_projects = [];
   const i = 0;
   while (ret_projects.length < required_projects && i < projects.length) {
      if (get_relevance(projects[i]) > min_relevance) {
         ret_projects.push(projects[i]);
      }
   }
   return ret_projects;
}

function get_relevance(project_keywords, user_keywords) {
   const relevance = 0;
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