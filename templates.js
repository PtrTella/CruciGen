// templates.js
// Pre-defined symmetric crossword grid templates.
// '#' represents a black square, ' ' (space) represents a white square.
// All templates are rotationally symmetric and have word lengths >= 3.

const TEMPLATES = {
  "9x9": [
    {
      name: "Standard 9x9 Symmetry A",
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
      name: "Cross 9x9 Symmetry B",
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
      name: "Dense 9x9 Symmetry C",
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
    }
  ],
  "11x11": [
    {
      name: "Classic 11x11 Symmetry A",
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
      name: "Symmetric 11x11 Pattern B",
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
    }
  ]
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TEMPLATES;
} else {
  window.TEMPLATES = TEMPLATES;
}
