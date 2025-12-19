// 设置模块 - 优化版
const ShezhiModule = (function() {
    let isOpen = false;
    let isEditMode = false;
    let currentFormula = '';
    
    function init() {
        createButton();
        createModal();
        LiebiaoModule.init();
    }
    
    function createButton() {
        const btn = document.createElement('div');
        btn.className = 'shezhi-btn';
        btn.innerHTML = '<i class="fas fa-cog"></i>';
        btn.onclick = openModal;
        document.body.appendChild(btn);
    }
    
    function createModal() {
        const modal = document.createElement('div');
        modal.className = 'shezhi-modal';
        modal.innerHTML = `
            <div class="shezhi-overlay"></div>
            <div class="shezhi-content">
                <div class="shezhi-header">
                    <h3>设置</h3>
                    <span class="shezhi-close" onclick="ShezhiModule.closeModal()">×</span>
                </div>
                <div class="shezhi-body">
                    <div class="shezhi-left">
                        <div class="shezhi-list" id="shezhiList"></div>
                    </div>
                    <div class="shezhi-right">
                        <div class="shezhi-formula">
                            <textarea id="formulaInput" placeholder="输入公式，格式：\n@通用{\n  利润:收入-成本;\n  利润率:利润/收入;\n}\n@张三{\n  奖金:利润*0.1;\n}" readonly></textarea>
                            <button class="formula-btn upload-btn" id="uploadBtn" onclick="ShangchuanModule.handleUpload()" title="上传Excel">
                                <i class="fas fa-upload"></i>
                            </button>
                            <button class="formula-btn" id="formulaBtn" onclick="ShezhiModule.toggleEditMode()" title="编辑">
                                <i class="fas fa-pen"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen && isEditMode) {
                const input = document.getElementById('formulaInput');
                input.value = currentFormula;
                isEditMode = false;
                input.readOnly = true;
                input.classList.remove('editing');
                updateButtonState(false);
            }
        });
    }
    
    function openModal() {
        if (isOpen) return;
        isOpen = true;
        isEditMode = false;
        
        const modal = document.querySelector('.shezhi-modal');
        modal.classList.add('show');
        
        FirebaseModule.getFormula((formula) => {
            currentFormula = formula;
            const input = document.getElementById('formulaInput');
            input.value = formula;
            input.readOnly = true;
            input.classList.remove('editing');
        });
        
        updateButtonState(false);
    }
    
    function closeModal() {
        isOpen = false;
        isEditMode = false;
        document.querySelector('.shezhi-modal').classList.remove('show');
    }
    
    function toggleEditMode() {
        const input = document.getElementById('formulaInput');
        
        if (!isEditMode) {
            isEditMode = true;
            input.readOnly = false;
            input.classList.add('editing');
            input.focus();
            updateButtonState(true);
        } else {
            saveFormula();
        }
    }
    
    function saveFormula() {
        const input = document.getElementById('formulaInput');
        const formula = input.value.trim();
        
        const btn = document.getElementById('formulaBtn');
        btn.disabled = true;
        
        FirebaseModule.saveFormula(formula)
            .then(() => {
                currentFormula = formula;
                isEditMode = false;
                input.readOnly = true;
                input.classList.remove('editing');
                updateButtonState(false);
                
                // 通过biaozhi触发计算
                const randomValue = Math.floor(Math.random() * 900) + 100;
                return firebase.database().ref('/peizhi/biaozhi').set(randomValue);
            })
            .then(() => {
                window.showToast(!formula ? '公式已清空。' : '公式已保存，开始计算...', 'success');
                btn.disabled = false;
            })
            .catch((error) => {
                console.error('保存失败：', error);
                window.showToast('保存失败：' + (error.message || '未知错误'), 'error');
                btn.disabled = false;
            });
    }
    
    function updateButtonState(editing) {
        const btn = document.getElementById('formulaBtn');
        if (!btn) return;
        
        if (editing) {
            btn.innerHTML = '<i class="fas fa-save"></i>';
            btn.classList.add('save-mode');
            btn.title = '保存';
        } else {
            btn.innerHTML = '<i class="fas fa-pen"></i>';
            btn.classList.remove('save-mode');
            btn.title = '编辑';
        }
    }
    
    return { 
        init, 
        closeModal, 
        toggleEditMode
    };
})();