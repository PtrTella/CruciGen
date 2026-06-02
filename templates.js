// templates.js
// Pre-defined symmetric crossword grid templates.
// '#' represents a black square, ' ' (space) represents a white square.

const TEMPLATES = {
  "9x9": [
    {
      name: "Symmetry Alpha",
      grid: [
        "   #   # ",
        "   #   # ",
        "         ",
        "##  #  ##",
        "   # #   ",
        "##  #  ##",
        "         ",
        " #   #   ",
        " #   #   "
      ]
    },
    {
      name: "Symmetry Beta",
      grid: [
        "         ",
        " # # # # ",
        "         ",
        " #  #  # ",
        "## # # ##",
        " #  #  # ",
        "         ",
        " # # # # ",
        "         "
      ]
    },
    {
      name: "Symmetry Gamma",
      grid: [
        "    #    ",
        " # # # # ",
        "         ",
        "##  #  ##",
        "   # #   ",
        "##  #  ##",
        "         ",
        " # # # # ",
        "    #    "
      ]
    },
    {
      name: "Symmetry Delta",
      grid: [
        "   #     ",
        " #   # # ",
        "   #     ",
        "##   # ##",
        "   #     ",
        "## #   ##",
        "     #   ",
        " # #   # ",
        "     #   "
      ]
    },
    {
      name: "Symmetry Epsilon",
      grid: [
        "         ",
        " #  #  # ",
        "   # #   ",
        "##     ##",
        " #  #  # ",
        "##     ##",
        "   # #   ",
        " #  #  # ",
        "         "
      ]
    },
    {
      name: "Symmetry Zeta",
      grid: [
        "         ",
        " #     # ",
        "   # #   ",
        " #     # ",
        "         ",
        " #     # ",
        "   # #   ",
        " #     # ",
        "         "
      ]
    },
    {
      name: "Symmetry Eta (Ultra Open)",
      grid: [
        "    #    ",
        "         ",
        "  #   #  ",
        "         ",
        "#       #",
        "         ",
        "  #   #  ",
        "         ",
        "    #    "
      ]
    }
  ],
  "11x11": [
    {
      name: "Classic Pattern 1",
      grid: [
        "    ###    ",
        " #   #   # ",
        "         ",
        "#  #   #  #",
        "    # #    ",
        " # #   # # ",
        "    # #    ",
        "#  #   #  #",
        "         ",
        " #   #   # ",
        "    ###    "
      ]
    },
    {
      name: "Classic Pattern 2",
      grid: [
        "     #     ",
        " # #   # # ",
        "     #     ",
        " # #   # # ",
        "     #     ",
        "###     ###",
        "     #     ",
        " # #   # # ",
        "     #     ",
        " # #   # # ",
        "     #     "
      ]
    },
    {
      name: "Classic Pattern 3",
      grid: [
        "   #   #   ",
        " #   #   # ",
        "           ",
        "##  # #  ##",
        "   #   #   ",
        " #   #   # ",
        "   #   #   ",
        "##  # #  ##",
        "           ",
        " #   #   # ",
        "   #   #   "
      ]
    },
    {
      name: "Classic Pattern 4",
      grid: [
        "           ",
        " # # # # # ",
        "           ",
        "## # # # ##",
        "   #   #   ",
        " # #   # # ",
        "   #   #   ",
        "## # # # ##",
        "           ",
        " # # # # # ",
        "           "
      ]
    },
    {
      name: "Classic Pattern 5",
      grid: [
        "     #     ",
        "   #   #   ",
        " #   #   # ",
        "   #   #   ",
        "##       ##",
        "   # # #   ",
        "##       ##",
        "   #   #   ",
        " #   #   # ",
        "   #   #   ",
        "     #     "
      ]
    },
    {
      name: "Classic Pattern 6",
      grid: [
        "           ",
        " #   #   # ",
        "   #   #   ",
        " #   #   # ",
        "           ",
        "###     ###",
        "           ",
        " #   #   # ",
        "   #   #   ",
        " #   #   # ",
        "           "
      ]
    },
    {
      name: "Classic Pattern 7 (Ultra Open)",
      grid: [
        "     #     ",
        "           ",
        " #   #   # ",
        "           ",
        "           ",
        "#         #",
        "           ",
        "           ",
        " #   #   # ",
        "           ",
        "     #     "
      ]
    }
  ],
  "13x13": [
    {
      name: "Grand Pattern Alpha",
      grid: [
        "      #      ",
        "      #      ",
        "  #   #   #  ",
        "  #       #  ",
        "  #       #  ",
        "             ",
        "##         ##",
        "             ",
        "  #       #  ",
        "  #       #  ",
        "  #   #   #  ",
        "      #      ",
        "      #      "
      ]
    }
  ],
  "15x15": [
    {
      name: "Colossus Pattern Alpha",
      grid: [
        "       #       ",
        "       #       ",
        "  #    #    #  ",
        "  #         #  ",
        "  #         #  ",
        "               ",
        "##           ##",
        "               ",
        "##           ##",
        "               ",
        "  #         #  ",
        "  #         #  ",
        "  #    #    #  ",
        "       #       ",
        "       #       "
      ]
    }
  ]
};

// Generates a randomized rotation/mirroring of a given grid template
function getRandomTransformation(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  
  // Convert array of strings to 2D array
  let matrix = grid.map(row => row.split(''));
  
  // Decide rotation (0, 90, 180, 270 degrees)
  const rotate = Math.floor(Math.random() * 4);
  // Decide mirroring (horizontal)
  const mirror = Math.random() > 0.5;
  
  // Apply rotation
  for (let r = 0; r < rotate; r++) {
    const nextMatrix = Array(cols).fill(null).map(() => Array(rows).fill(' '));
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        nextMatrix[j][rows - 1 - i] = matrix[i][j];
      }
    }
    matrix = nextMatrix;
  }
  
  // Apply mirroring
  if (mirror) {
    for (let i = 0; i < matrix.length; i++) {
      matrix[i].reverse();
    }
  }
  
  return matrix.map(row => row.join(''));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TEMPLATES, getRandomTransformation };
} else {
  window.TEMPLATES = TEMPLATES;
  window.getRandomTransformation = getRandomTransformation;
}
