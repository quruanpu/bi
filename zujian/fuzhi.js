// 复制模块 - 全屏截图版
const FuzhiModule = (function() {
    
    // 备用渐变背景
    const FALLBACK_BG = 'linear-gradient(135deg, #0a0e1a 0%, #1a1f2e 50%, #0f1923 100%)';
    
    function init() {
        const btn = document.createElement('div');
        btn.className = 'action-btn fuzhi-btn';
        btn.innerHTML = '<i class="fas fa-copy"></i>';
        btn.title = '复制为图片';
        btn.onclick = handleCopy;
        document.body.appendChild(btn);
    }
    
    // 获取背景图片URL
    function getBgImageUrl() {
        const bgImage = getComputedStyle(document.documentElement).getPropertyValue('--bg-image').trim();
        const match = bgImage.match(/url\(['"]?([^'"()]+)['"]?\)/);
        return match ? match[1] : null;
    }
    
    // 预加载图片并转为base64
    function loadImageAsBase64(url, timeout = 3000) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            const timer = setTimeout(() => {
                resolve(null);
            }, timeout);
            
            img.onload = () => {
                clearTimeout(timer);
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const base64 = canvas.toDataURL('image/png');
                    resolve(base64);
                } catch (e) {
                    resolve(null);
                }
            };
            
            img.onerror = () => {
                clearTimeout(timer);
                resolve(null);
            };
            
            img.src = url;
        });
    }
    
    async function handleCopy() {
        const table = document.getElementById('dataTable');
        
        if (!table || !table.querySelector('tbody tr')) {
            window.showToast('没有数据可复制。', 'warning');
            return;
        }
        
        if (typeof html2canvas === 'undefined') {
            window.showToast('截图库未加载。', 'error');
            return;
        }
        
        let tempContainer = null;
        let mask = null;
        
        try {
            // 创建遮罩层（用户可见）
            mask = document.createElement('div');
            mask.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                z-index: 99995;
                background: linear-gradient(135deg, #0a0e1a 0%, #1a1f2e 50%, #0f1923 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                color: #00ccff;
                font-size: 18px;
                font-family: 'Orbitron', 'Rajdhani', sans-serif;
                letter-spacing: 3px;
                text-transform: uppercase;
                text-shadow: 0 0 20px rgba(0, 204, 255, 0.8);
            `;
            mask.textContent = '正在生成截图...';
            document.body.appendChild(mask);
            
            // 预加载背景图片
            const bgUrl = getBgImageUrl();
            const bgBase64 = bgUrl ? await loadImageAsBase64(bgUrl) : null;
            const bgStyle = bgBase64 ? `url("${bgBase64}")` : FALLBACK_BG;
            
            const tableWidth = table.scrollWidth;
            const tableHeight = table.scrollHeight;
            const viewWidth = Math.max(window.innerWidth, tableWidth + 100);
            const viewHeight = Math.max(window.innerHeight, tableHeight + 200);
            
            // 创建临时容器（在遮罩下方）
            tempContainer = document.createElement('div');
            tempContainer.id = 'screenshotContainer';
            tempContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: ${viewWidth}px;
                height: ${viewHeight}px;
                z-index: 99990;
                background-color: #0a0e1a;
                background-image: ${bgStyle};
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: ${window.getComputedStyle(document.body).fontFamily};
                overflow: hidden;
            `;
            
            // 添加背景遮罩层（与页面一致）
            const bgOverlay = document.createElement('div');
            bgOverlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(10, 14, 26, 0.3);
                pointer-events: none;
            `;
            tempContainer.appendChild(bgOverlay);
            
            // 克隆主容器
            const mainContainer = document.querySelector('.main-container');
            if (mainContainer) {
                const clonedMain = mainContainer.cloneNode(true);
                clonedMain.style.cssText = `
                    position: relative;
                    z-index: 1;
                    width: ${tableWidth + 60}px;
                    height: ${tableHeight + 100}px;
                    max-width: none;
                    max-height: none;
                    min-width: unset;
                    min-height: unset;
                `;
                tempContainer.appendChild(clonedMain);
                
                const clonedWrapper = clonedMain.querySelector('.table-wrapper');
                if (clonedWrapper) clonedWrapper.style.overflow = 'visible';
                
                const clonedScroll = clonedMain.querySelector('.table-scroll');
                if (clonedScroll) clonedScroll.style.overflow = 'visible';
                
                const clonedTable = clonedMain.querySelector('.data-table');
                if (clonedTable) {
                    clonedTable.querySelectorAll('thead, thead th:first-child, tbody td:first-child').forEach(el => {
                        el.style.position = 'relative';
                        el.style.left = '0';
                        el.style.top = '0';
                    });
                }
            }
            
            // 克隆信息栏
            function cloneInfoPanel(selector, x, y, position) {
                const element = document.querySelector(selector);
                if (!element) return;
                
                const cloned = element.cloneNode(true);
                cloned.style.position = 'absolute';
                cloned.style.zIndex = '2';
                
                if (position.includes('top')) cloned.style.top = y;
                if (position.includes('bottom')) cloned.style.bottom = y;
                if (position.includes('left')) cloned.style.left = x;
                if (position.includes('right')) cloned.style.right = x;
                if (position.includes('right')) cloned.style.left = 'auto';
                if (position.includes('bottom')) cloned.style.top = 'auto';
                
                tempContainer.appendChild(cloned);
            }
            
            cloneInfoPanel('.datetime-group', '16px', '16px', 'top-left');
            cloneInfoPanel('.top-info-bar', '16px', '16px', 'top-right');
            cloneInfoPanel('.update-info', '16px', '16px', 'bottom-left');
            
            // 克隆按钮
            function cloneButton(selector, rightOffset, isSettingBtn) {
                const btn = document.querySelector(selector);
                if (!btn) return;
                
                const cloned = btn.cloneNode(true);
                const clipSize = isSettingBtn ? '8px' : '6px';
                cloned.style.cssText = `
                    position: absolute;
                    z-index: 2;
                    right: ${rightOffset};
                    bottom: 12px;
                    width: 32px;
                    height: 32px;
                    background: rgba(20, 24, 36, 0.95);
                    border: 2px solid #0080ff;
                    color: #00ccff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    clip-path: polygon(0 0, calc(100% - ${clipSize}) 0, 100% ${clipSize}, 100% 100%, ${clipSize} 100%, 0 calc(100% - ${clipSize}));
                    box-shadow: 0 0 20px rgba(0, 128, 255, 0.6);
                `;
                
                const icon = cloned.querySelector('i');
                if (icon) {
                    icon.style.cssText = `
                        font-size: ${isSettingBtn ? '15px' : '14px'};
                        color: #00ccff;
                        font-family: "Font Awesome 6 Free", "FontAwesome", sans-serif;
                        font-weight: 900;
                        line-height: 1;
                        display: block;
                        margin: 0;
                        padding: ${isSettingBtn ? '8px 0 9px 0' : '8px 0 10px 0'};
                        text-align: center;
                        width: 100%;
                        box-sizing: border-box;
                        text-rendering: optimizeLegibility;
                        -webkit-font-smoothing: antialiased;
                        -moz-osx-font-smoothing: grayscale;
                    `;
                }
                
                tempContainer.appendChild(cloned);
            }
            
            cloneButton('.chakan-btn', '138px', false);
            cloneButton('.shezhi-btn', '12px', true);
            cloneButton('.xiazai-btn', '54px', false);
            cloneButton('.fuzhi-btn', '96px', false);
            
            document.body.appendChild(tempContainer);
            
            // 等待渲染
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            await new Promise(r => setTimeout(r, 300));
            
            // 截图
            const canvas = await html2canvas(tempContainer, {
                backgroundColor: '#0a0e1a',
                scale: 2,
                width: viewWidth,
                height: viewHeight,
                windowWidth: viewWidth,
                windowHeight: viewHeight,
                logging: false,
                useCORS: true,
                allowTaint: true
            });
            
            // 移除临时容器和遮罩
            tempContainer.remove();
            tempContainer = null;
            mask.remove();
            mask = null;
            
            // 复制到剪贴板
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    window.showToast('生成图片失败。', 'error');
                    return;
                }
                
                try {
                    window.focus();
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    window.showToast('已复制到剪贴板。', 'success');
                } catch (err) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `业绩数据_${new Date().toLocaleDateString().replace(/\//g, '')}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                    window.showToast('已保存为图片文件。', 'success');
                }
            }, 'image/png', 1.0);
            
        } catch (error) {
            if (tempContainer) tempContainer.remove();
            if (mask) mask.remove();
            window.showToast('复制失败：' + error.message, 'error');
        }
    }
    
    return { init };
})();