async function main() {
  // Total number of layers to be processed
  let totalLayers = 0;
  // Number of layers processed so far
  let processedLayers = 0;

  // Preload only the fonts used in the current page's text nodes
  async function preloadFonts() {
    const textNodes = figma.currentPage.findAll(node => node.type === 'TEXT');
    const fonts = new Set();
    textNodes.forEach(node => {
      if ("characters" in node) {
        for (let i = 0; i < node.characters.length; i++) {
          const fontName = node.getRangeFontName(i, i + 1);
          if (fontName !== figma.mixed) {
            fonts.add(fontName);
          }
        }
      }
    });
    try {
      await Promise.all(Array.from(fonts).map(font => {
        if (font && typeof font === 'object' && 'family' in font && 'style' in font) {
          return figma.loadFontAsync(font as FontName);
        }
      }));
    } catch (error) {
      console.error('Error loading fonts:', error);
      throw error;
    }
  }

  // Function to map CSS fontWeight to Apple SD Gothic Neo or SF Pro font style
  function getFontStyle(cssWeight: number, isKorean: boolean) {
    if (isKorean) {
      if (cssWeight <= 149) {
        return { family: 'Apple SD Gothic Neo', style: 'Thin' };
      } else if (cssWeight >= 150 && cssWeight < 250) {
        return { family: 'Apple SD Gothic Neo', style: 'UltraLight' };
      } else if (cssWeight >= 250 && cssWeight < 350) {
        return { family: 'Apple SD Gothic Neo', style: 'Light' };
      } else if (cssWeight >= 350 && cssWeight < 450) {
        return { family: 'Apple SD Gothic Neo', style: 'Regular' };
      } else if (cssWeight >= 450 && cssWeight < 550) {
        return { family: 'Apple SD Gothic Neo', style: 'Medium' };
      } else if (cssWeight >= 550 && cssWeight < 650) {
        return { family: 'Apple SD Gothic Neo', style: 'SemiBold' };
      } else if (cssWeight >= 650 && cssWeight < 750) {
        return { family: 'Apple SD Gothic Neo', style: 'Bold' };
      } else if (cssWeight >= 750 && cssWeight < 850) {
        return { family: 'Apple SD Gothic Neo', style: 'ExtraBold' };
      } else if (cssWeight >= 850) {
        return { family: 'Apple SD Gothic Neo', style: 'Heavy' };
      } else {
        return { family: 'Apple SD Gothic Neo', style: 'Regular' };
      }
    } else {
      if (cssWeight <= 149) {
        return { family: 'SF Pro', style: 'Ultralight' };
      } else if (cssWeight >= 150 && cssWeight < 250) {
        return { family: 'SF Pro', style: 'Thin' };
      } else if (cssWeight >= 250 && cssWeight < 350) {
        return { family: 'SF Pro', style: 'Light' };
      } else if (cssWeight >= 350 && cssWeight < 450) {
        return { family: 'SF Pro', style: 'Regular' };
      } else if (cssWeight >= 450 && cssWeight < 550) {
        return { family: 'SF Pro', style: 'Medium' };
      } else if (cssWeight >= 550 && cssWeight < 650) {
        return { family: 'SF Pro', style: 'Semibold' };
      } else if (cssWeight >= 650 && cssWeight < 750) {
        return { family: 'SF Pro', style: 'Bold' };
      } else if (cssWeight >= 750 && cssWeight < 850) {
        return { family: 'SF Pro', style: 'Heavy' };
      } else if (cssWeight >= 850) {
        return { family: 'SF Pro', style: 'Black' };
      } else {
        return { family: 'SF Pro', style: 'Regular' };
      }
    }
  }

  // Load all fonts used in a node and its children, and change them to Apple SD Gothic Neo or SF Pro
  async function loadFontsAndChange(node: SceneNode) {
    if (node.type === 'TEXT' && node.visible && !node.locked && !node.removed && node.parent && node.parent.type !== 'INSTANCE') {
      totalLayers++;
      for (let i = 0; i < node.characters.length; i++) {
        const fontName = node.getRangeFontName(i, i + 1);
        if (fontName !== figma.mixed) {
          try {
            const fontWeight = node.getRangeFontWeight(i, i + 1);
            if (fontWeight !== figma.mixed) {
              const isKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(node.characters[i]);
              const newFont = getFontStyle(fontWeight as number, isKorean);
              await figma.loadFontAsync(newFont);
              node.setRangeFontName(i, i + 1, newFont);
            }
          } catch (error) {
            console.error('Error loading font:', error);
            throw error;
          }
        }
      }
      processedLayers++;
    }

    if ("children" in node) {
      for (const child of node.children) {
        if (child.visible && !child.locked && !child.removed) {
          await loadFontsAndChange(child);
        }
      }
    }
  }

    // If no layer is selected, notify the user and terminate the plugin.
    if (figma.currentPage.selection.length === 0) {
      figma.notify("Please select one or more layers", { timeout: 1500 });
      figma.closePlugin();
      return;
    }
  // Preload all fonts.
  await preloadFonts();

  for (const node of figma.currentPage.selection) {
    if (node.visible && !node.locked && !node.removed) {
      await loadFontsAndChange(node);
    }
  }

  figma.closePlugin(`Number of layers changed: ${processedLayers}`);
}

main();