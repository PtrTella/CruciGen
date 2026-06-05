// src/js/worker/trie.js
// Struttura dati Trie per l'indicizzazione efficiente del dizionario nel Web Worker.

class TrieNode {
  constructor() {
    this.children = {};
    this.isWord = false;
  }
}

// Una radice ad albero per ogni lunghezza di parola (visibile a livello globale del worker)
trieRoots = {}; 

function insertWord(word, length) {
  if (!trieRoots[length]) trieRoots[length] = new TrieNode();
  let node = trieRoots[length];
  for (let char of word) {
    if (!node.children[char]) node.children[char] = new TrieNode();
    node = node.children[char];
  }
  node.isWord = true;
}
