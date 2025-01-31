console.clear();

async function main() {
  // UI 생성
  figma.showUI(__html__, { width: 240, height: 120, themeColors: true });

  // 전역 변수 선언
  let totalLayers = 0;
  let processedLayers = 0;
  let changedCharacters = 0;

  // 선택된 레이어 상태 체크 함수
  function checkSelection() {
    const hasSelection = figma.currentPage.selection.length > 0;
    const hasTextNodes = figma.currentPage.selection.some(node => {
      if (node.type === 'TEXT') return true;
      if ('children' in node) {
        return findTextNode(node);
      }
      return false;
    });
    
    figma.ui.postMessage({ 
      type: 'selection-change',
      hasValidSelection: hasSelection && hasTextNodes
    });
  }

  // 재귀적으로 텍스트 노드 찾기
  function findTextNode(node: SceneNode): boolean {
    if (node.type === 'TEXT') return true;
    if ('children' in node) {
      return node.children.some(child => findTextNode(child));
    }
    return false;
  }

  // 초기 상태 체크
  checkSelection();

  // 선택 변경 이벤트 리스너
  figma.on('selectionchange', () => {
    checkSelection();
  });

  // UI로부터 메시지 수신
  figma.ui.onmessage = async (msg) => {
    if (msg.type === 'start-font-change') {
      console.clear(); // 콘솔 초기화
      console.log('🚀 폰트 변경 작업 시작');
      const shouldApplyTracking = msg.applyTracking;
      console.log(`✓ 자간 적용 여부: ${shouldApplyTracking}`);
      
      // 카운터 초기화
      totalLayers = 0;
      processedLayers = 0;
      changedCharacters = 0;
      let totalCharacters = 0;

      console.log('📊 선택된 텍스트 분석 시작...');
      // 먼저 총 글자 수 계산
      for (const node of figma.currentPage.selection) {
        const nodeCharCount = countCharacters(node);
        totalCharacters += nodeCharCount;
        console.log(`  ↳ 텍스트 노드 발견: ${nodeCharCount}자`);
        figma.ui.postMessage({
          type: 'update-status',
          message: `변경 완료: 0/${totalCharacters}`
        });
      }
      console.log(`✓ 총 변경 대상: ${totalCharacters}자`);

      console.log('📥 폰트 프리로드 시작...');
      // Preload all fonts and get font cache
      const fontCache = await preloadFonts();
      console.log(`✓ 폰트 캐시 생성 완료 (${fontCache.size}개 폰트)`);

      console.log('�� 폰트 변경 작업 실행...');
      // Process all selected nodes and their descendants
      for (const node of figma.currentPage.selection) {
        await loadFontsAndChange(node, fontCache, shouldApplyTracking, totalCharacters);
      }

      console.log('✨ 작업 완료');
      console.log(`  ↳ 처리된 레이어: ${processedLayers}`);
      console.log(`  ↳ 변경된 글자: ${changedCharacters}/${totalCharacters}`);

      // 상태 텍스트 업데이트: 작업 완료
      figma.ui.postMessage({
        type: 'process-complete',
        message: `변경 완료: ${changedCharacters}/${totalCharacters}`
      });
    }
  };

  // 총 글자 수를 계산하는 함수
  function countCharacters(node: SceneNode): number {
    let count = 0;
    if (node.type === 'TEXT' && node.visible && !node.locked && !node.removed) {
      count += node.characters.length;
    } else if ("children" in node) {
      for (const child of node.children) {
        count += countCharacters(child);
      }
    }
    return count;
  }

  // Preload only the fonts used in the current page's text nodes
  async function preloadFonts() {
    const textNodesCriteria = {
      types: ["TEXT"] as Array<"TEXT">,
    };
    const textNodes = figma.currentPage.findAllWithCriteria(textNodesCriteria);
    console.log(`  ↳ 텍스트 노드 스캔 완료: ${textNodes.length}개 발견`);
    
    const fontCache = new Map<string, FontName>();
    const fonts = new Set<FontName>();
    
    console.log('  ↳ 사용 중인 폰트 수집...');
    textNodes.forEach(node => {
      if ("characters" in node) {
        const characters = node.characters;
        let prevFontName: FontName | typeof figma.mixed = figma.mixed;
        
        for (let i = 0; i < characters.length; i++) {
          const fontName = node.getRangeFontName(i, i + 1);
          if (fontName !== figma.mixed && fontName !== prevFontName) {
            fonts.add(fontName);
            prevFontName = fontName;
          }
        }
      }
    });
    console.log(`  ↳ 폰트 수집 완료: ${fonts.size}개 폰트 발견`);

    console.log('  ↳ 폰트 로딩 시작...');
    const loadPromises = Array.from(fonts).map(async font => {
      if (font && typeof font === 'object' && 'family' in font && 'style' in font) {
        try {
          await figma.loadFontAsync(font as FontName);
          const key = `${font.family}-${font.style}`;
          fontCache.set(key, font as FontName);
          console.log(`    ✓ 로드 완료: ${font.family} ${font.style}`);
        } catch (error) {
          console.error(`    ✗ 로드 실패: ${font.family} ${font.style}`, error);
        }
      }
    });

    await Promise.all(loadPromises);
    return fontCache;
  }

  // Function to map CSS fontWeight to Apple SD Gothic Neo or SF Pro font style
  function getFontStyle(cssWeight: number, isKorean: boolean) {
    if (isKorean) {
      const styles = [
        { max: 149, style: 'Thin' },
        { max: 249, style: 'UltraLight' },
        { max: 349, style: 'Light' },
        { max: 449, style: 'Regular' },
        { max: 549, style: 'Medium' },
        { max: 649, style: 'SemiBold' },
        { max: 749, style: 'Bold' },
        { max: 849, style: 'ExtraBold' },
        { max: Infinity, style: 'Heavy' }
      ];
      const styleObj = styles.find(s => cssWeight <= s.max);
      const style = styleObj ? styleObj.style : 'Regular';
      return { family: 'Apple SD Gothic Neo', style };
    } else {
      const sfProStyles = [
        { max: 149, style: 'Ultralight' },
        { max: 249, style: 'Thin' },
        { max: 349, style: 'Light' },
        { max: 449, style: 'Regular' },
        { max: 549, style: 'Medium' },
        { max: 649, style: 'Semibold' },
        { max: 749, style: 'Bold' },
        { max: 849, style: 'Heavy' },
        { max: Infinity, style: 'Black' }
      ];
      const sfProStyleObj = sfProStyles.find(s => cssWeight <= s.max);
      const sfProStyle = sfProStyleObj ? sfProStyleObj.style : 'Regular';
      return { family: 'SF Pro', style: sfProStyle };
    }
  }

  // Load all fonts used in a node and its children, and change them to Apple SD Gothic Neo or SF Pro
  async function loadFontsAndChange(node: SceneNode, fontCache: Map<string, FontName>, shouldApplyTracking: boolean, totalCharacters: number) {
    if (node.type === 'TEXT' && node.visible && !node.locked && !node.removed) {
      totalLayers++;
      const characters = node.characters;
      let lastUpdateTime = Date.now();
      const updateInterval = 16; // 약 60fps에 해당하는 시간 간격
      
      for (let j = 0; j < characters.length; j++) {
        const char = characters[j];
        const isKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(char);
        const fontWeight = node.getRangeFontWeight(j, j + 1);
        const newFont = getFontStyle(fontWeight as number, isKorean);
        const fontKey = `${newFont.family}-${newFont.style}`;
        
        if (!fontCache.has(fontKey)) {
          fontCache.set(fontKey, newFont);
          await figma.loadFontAsync(newFont);
        }
        
        node.setRangeFontName(j, j + 1, newFont);
        changedCharacters++;

        const fontSize = node.getRangeFontSize(j, j + 1);
        const trackingValues: { [key: number]: number } = {
          6: 0.24,
          7: 0.23,
          8: 0.21,
          9: 0.17,
          10: 0.12,
          11: 0.06,
          12: 0,
          13: -0.08,
          14: -0.15,
          15: -0.23,
          16: -0.31,
          17: -0.43,
          18: -0.44,
          19: -0.45,
          20: -0.45,
          21: -0.36,
          22: -0.26,
          23: -0.10,
          24: 0.07,
          25: 0.15,
          26: 0.22,
          27: 0.29,
          28: 0.38,
          29: 0.40,
          30: 0.40,
          31: 0.39,
          32: 0.41,
          33: 0.40,
          34: 0.40,
          35: 0.38,
          36: 0.37,
          37: 0.36,
          38: 0.37,
          39: 0.38,
          40: 0.37,
          41: 0.36,
          42: 0.37,
          43: 0.38,
          44: 0.37,
          45: 0.35,
          46: 0.36,
          47: 0.37,
          48: 0.35,
          49: 0.33,
          50: 0.34,
          51: 0.35,
          52: 0.33,
          53: 0.31,
          54: 0.32,
          56: 0.30,
          58: 0.28,
          60: 0.26,
          62: 0.24,
          64: 0.22,
          66: 0.19,
          68: 0.17,
          70: 0.14,
          72: 0.14,
          76: 0.07,
          80: 0,
          84: 0,
          88: 0,
          92: 0,
          96: 0
        };
        const tracking = trackingValues[fontSize as number];
        if (tracking !== undefined && !isKorean && shouldApplyTracking) {
          node.setRangeLetterSpacing(j, j + 1, { value: tracking, unit: 'PIXELS' });
        }

        // 일정 시간 간격으로만 UI 업데이트
        const currentTime = Date.now();
        if (currentTime - lastUpdateTime >= updateInterval) {
          figma.ui.postMessage({
            type: 'update-status',
            message: `변경 완료: ${changedCharacters}/${totalCharacters}`
          });
          lastUpdateTime = currentTime;
        }
      }
      processedLayers++;
    } else if ("children" in node) {
      for (const child of node.children) {
        await loadFontsAndChange(child, fontCache, shouldApplyTracking, totalCharacters);
      }
    }
  }
}

main();
