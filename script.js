// 主脚本 - 简化版 (v1.09)
let globalData = {};

// 简化的加载特效控制
const LoadingController = {
    hide: function() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('fade-out');
            setTimeout(() => overlay.remove(), 800);
        }
    }
};

// 提示模块
const Toast = {
    show: (message, type = 'info') => {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 500);
        }, 2500);
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化信息显示模块
    XinxiModule.init();
    
    // 初始化Firebase
    FirebaseModule.init(connected => {
        XinxiModule.updateConnectionStatus(connected);
        
        if (connected) {
            firebase.database().ref('/fuzeren').on('value', (snapshot) => {
                const data = snapshot.val();
                XinxiModule.updatePeopleCount(data ? Object.keys(data).length : 0);
            });
        }
    });
    
    // 初始化其他模块
    ShezhiModule.init();
    
    if (typeof ShangchuanModule !== 'undefined') {
        ShangchuanModule.init();
    }
    
    if (typeof XiazaiModule !== 'undefined') {
        XiazaiModule.init();
    }
    
    if (typeof FuzhiModule !== 'undefined') {
        FuzhiModule.init();
    }
    
    if (typeof ChakanModule !== 'undefined') {
        ChakanModule.init();
    }
});

// 事件监听
window.addEventListener('resize', TableModule.setTableDimensions);
window.addEventListener('online', () => FirebaseModule.reconnect());
window.addEventListener('offline', () => XinxiModule.updateConnectionStatus(false));

// 全局方法
window.showToast = Toast.show;
window.updateStatus = XinxiModule.updateConnectionStatus;
window.LoadingController = LoadingController;