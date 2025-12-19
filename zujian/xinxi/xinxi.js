// 信息显示模块 (v1.1)
const XinxiModule = (function() {
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    let clockInterval = null;
    
    // 启动实时时钟
    function startRealtimeClock() {
        function updateClock() {
            const now = new Date();
            
            // 时分秒
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            document.getElementById('clockTime').textContent = `${hours}:${minutes}:${seconds}`;
            
            // 年月日
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            document.getElementById('clockDate').textContent = `${year}/${month}/${day}`;
            
            // 星期
            document.getElementById('clockWeek').textContent = weekDays[now.getDay()];
        }
        
        updateClock();
        if (clockInterval) clearInterval(clockInterval);
        clockInterval = setInterval(updateClock, 1000);
    }
    
    // 更新时间进度
    function updateTimeProgress() {
        const now = new Date();
        const currentDay = now.getDate() - 1;
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const percentage = Math.round((currentDay / daysInMonth) * 100);
        document.getElementById('timeProgress').textContent = `${percentage}%`;
    }
    
    // 更新人数
    function updatePeopleCount(count) {
        document.getElementById('peopleCount').textContent = count;
    }
    
    // 更新连接状态
    function updateConnectionStatus(connected) {
        document.getElementById('statusIndicator').className = connected ? 'status-dot' : 'status-dot disconnected';
    }
    
    // 更新数据时间显示
    function updateDataTime(shijian, jindu) {
        if (!shijian) return;
        
        // 解析BI更新时间 (格式: 2025/09/23 23:43:21)
        const [datePart, timePart] = shijian.split(' ');
        const [year, month, day] = datePart.split('/');
        const [hour] = timePart.split(':');
        
        // 判断是否在14:00之前
        const isBeforeTwopm = Number(hour) < 14;
        
        // 计算数据截止时间
        const daysToSubtract = isBeforeTwopm ? 2 : 1;  // 14:00前减2天，否则减1天
        const deadlineDate = new Date(year, month - 1, day);
        deadlineDate.setDate(deadlineDate.getDate() - daysToSubtract);
        
        const deadlineYear = deadlineDate.getFullYear();
        const deadlineMonth = String(deadlineDate.getMonth() + 1).padStart(2, '0');
        const deadlineDay = String(deadlineDate.getDate()).padStart(2, '0');
        const deadlineStr = `${deadlineYear}/${deadlineMonth}/${deadlineDay} 23:59`;
        
        // 更新显示
        document.getElementById('dataDeadline').textContent = `${deadlineStr} · ${jindu}`;
        document.getElementById('biUpdateTime').textContent = shijian;
    }
    
    // 初始化
    function init() {
        startRealtimeClock();
        updateTimeProgress();
        updateConnectionStatus(false);
    }
    
    // 销毁
    function destroy() {
        if (clockInterval) {
            clearInterval(clockInterval);
            clockInterval = null;
        }
    }
    
    // 公开接口
    return {
        init,
        destroy,
        updateTimeProgress,
        updatePeopleCount,
        updateConnectionStatus,
        updateDataTime
    };
})();