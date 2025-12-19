// 查看模块 - 全屏阅读模式
const ChakanModule = (function() {
    let isFullscreen = false;
    let originalStyles = {};
    
    function init() {
        createButton();
        bindKeyboardEvents();
        injectStyles();
    }
    
    // 注入样式
    function injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            /* 查看按钮样式 */
            .chakan-btn {
                position: fixed;
                bottom: 12px;
                right: 138px;
                width: 32px;
                height: 32px;
                border-radius: 0;
                background: rgba(20, 24, 36, 0.95);
                backdrop-filter: blur(10px);
                border: 2px solid #0080ff;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 999;
                box-shadow: 0 0 20px rgba(0, 128, 255, 0.6);
                transition: all 0.3s ease;
                color: #00ccff;
                clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
            }
            
            .chakan-btn:hover {
                background: rgba(0, 128, 255, 0.2);
                box-shadow: 
                    0 0 30px rgba(0, 128, 255, 0.8),
                    inset 0 0 20px rgba(0, 204, 255, 0.3);
                border-color: #00ccff;
            }
            
            .chakan-btn i {
                font-size: 14px;
            }
            
            /* 全屏模式下保持查看按钮显示并调整位置 */
            body.reading-mode .chakan-btn {
                position: fixed;
                top: 20px;
                right: 20px;
                bottom: auto;
                z-index: 10001;
                background: rgba(20, 24, 36, 0.98);
                border-color: #00ffcc;
                box-shadow: 0 0 30px rgba(0, 255, 204, 0.6);
            }
            
            /* 阅读模式样式 */
            body.reading-mode .main-container {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                max-width: none !important;
                max-height: none !important;
                min-width: unset !important;
                min-height: unset !important;
                z-index: 10000 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }
            
            body.reading-mode .table-container {
                width: calc(100vw - 40px) !important;
                height: calc(100vh - 40px) !important;
                max-width: none !important;
                max-height: none !important;
            }
            
            body.reading-mode .table-wrapper {
                width: calc(100% - 24px) !important;
                height: calc(100% - 24px) !important;
            }
            
            body.reading-mode .table-scroll {
                width: 100% !important;
                height: 100% !important;
            }
            
            /* 隐藏信息组件和其他按钮 */
            body.reading-mode .info-container,
            body.reading-mode .action-btn:not(.chakan-btn),
            body.reading-mode .shezhi-btn {
                display: none !important;
            }
            
            /* 退出提示 */
            .exit-hint {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                padding: 8px 20px;
                background: rgba(20, 24, 36, 0.95);
                border: 1px solid #0080ff;
                color: #00ccff;
                font-size: 12px;
                z-index: 10001;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            body.reading-mode .exit-hint {
                opacity: 1;
                animation: fadeInOut 3s ease;
            }
            
            @keyframes fadeInOut {
                0% { opacity: 0; }
                20% { opacity: 1; }
                80% { opacity: 1; }
                100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    function createButton() {
        const btn = document.createElement('div');
        btn.className = 'action-btn chakan-btn';
        btn.innerHTML = '<i class="fas fa-expand"></i>';
        btn.title = '全屏查看';
        btn.onclick = toggleFullscreen;
        document.body.appendChild(btn);
    }
    
    function toggleFullscreen() {
        if (!isFullscreen) {
            enterFullscreen();
        } else {
            exitFullscreen();
        }
    }
    
    function enterFullscreen() {
        // 保存当前状态
        const mainContainer = document.querySelector('.main-container');
        const tableContainer = document.querySelector('.table-container');
        const tableWrapper = document.querySelector('.table-wrapper');
        const tableScroll = document.querySelector('.table-scroll');
        
        if (mainContainer) {
            originalStyles.mainContainer = mainContainer.style.cssText;
        }
        if (tableContainer) {
            originalStyles.tableContainer = tableContainer.style.cssText;
        }
        if (tableWrapper) {
            originalStyles.tableWrapper = tableWrapper.style.cssText;
        }
        if (tableScroll) {
            originalStyles.tableScroll = tableScroll.style.cssText;
        }
        
        // 添加全屏类
        document.body.classList.add('reading-mode');
        
        // 更新按钮图标和提示
        const btn = document.querySelector('.chakan-btn');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-compress"></i>';
            btn.title = '退出全屏';
        }
        
        // 显示退出提示
        showExitHint();
        
        // 调用表格重新计算尺寸
        if (typeof TableModule !== 'undefined' && TableModule.setTableDimensions) {
            setTimeout(() => {
                TableModule.setTableDimensions();
            }, 100);
        }
        
        isFullscreen = true;
    }
    
    function exitFullscreen() {
        // 移除全屏类
        document.body.classList.remove('reading-mode');
        
        // 恢复原始样式
        const mainContainer = document.querySelector('.main-container');
        const tableContainer = document.querySelector('.table-container');
        const tableWrapper = document.querySelector('.table-wrapper');
        const tableScroll = document.querySelector('.table-scroll');
        
        if (mainContainer && originalStyles.mainContainer) {
            mainContainer.style.cssText = originalStyles.mainContainer;
        }
        if (tableContainer && originalStyles.tableContainer) {
            tableContainer.style.cssText = originalStyles.tableContainer;
        }
        if (tableWrapper && originalStyles.tableWrapper) {
            tableWrapper.style.cssText = originalStyles.tableWrapper;
        }
        if (tableScroll && originalStyles.tableScroll) {
            tableScroll.style.cssText = originalStyles.tableScroll;
        }
        
        // 更新按钮图标和提示
        const btn = document.querySelector('.chakan-btn');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-expand"></i>';
            btn.title = '全屏查看';
        }
        
        // 移除退出提示
        const hint = document.querySelector('.exit-hint');
        if (hint) {
            hint.remove();
        }
        
        // 调用表格重新计算尺寸
        if (typeof TableModule !== 'undefined' && TableModule.setTableDimensions) {
            setTimeout(() => {
                TableModule.setTableDimensions();
            }, 100);
        }
        
        isFullscreen = false;
    }
    
    function showExitHint() {
        const hint = document.createElement('div');
        hint.className = 'exit-hint';
        hint.textContent = '按 ESC 退出全屏';
        document.body.appendChild(hint);
        
        // 3秒后自动移除提示
        setTimeout(() => {
            hint.remove();
        }, 3000);
    }
    
    function bindKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isFullscreen) {
                e.preventDefault();
                exitFullscreen();
            }
        });
    }
    
    // 公开方法
    return {
        init,
        isFullscreen: () => isFullscreen,
        exit: exitFullscreen
    };
})();