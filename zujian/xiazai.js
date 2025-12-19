// 下载模块 - 使用内存数据版（v1.09）
const XiazaiModule = (function() {
    
    function init() {
        createButton();
    }
    
    function createButton() {
        const btn = document.createElement('div');
        btn.className = 'action-btn xiazai-btn';
        btn.innerHTML = '<i class="fas fa-download"></i>';
        btn.title = '下载Excel';
        btn.onclick = handleDownload;
        document.body.appendChild(btn);
    }
    
    function handleDownload() {
        if (!globalData || Object.keys(globalData).length === 0) {
            window.showToast('没有数据可下载。', 'warning');
            return;
        }
        
        try {
            const { fuzeren, mirror } = TableModule.getCurrentData();
            const visibleFields = TableModule.getVisibleFields();
            
            if (visibleFields.length === 0) {
                window.showToast('没有可见字段。', 'warning');
                return;
            }
            
            const data = buildExportData(visibleFields, fuzeren, mirror);
            
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(data);
            
            const colWidths = visibleFields.map(field => {
                if (field === 'name') return { wch: 12 };
                return { wch: 15 };
            });
            ws['!cols'] = colWidths;
            
            XLSX.utils.book_append_sheet(wb, ws, '业绩数据');
            
            const date = new Date();
            const filename = `业绩数据_${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}_${date.getHours()}${date.getMinutes()}.xlsx`;
            
            XLSX.writeFile(wb, filename);
            window.showToast('下载成功。', 'success');
            
        } catch (error) {
            window.showToast('下载失败：' + error.message, 'error');
        }
    }
    
    function sortPersonsByOrder(fuzerenData) {
        return Object.entries(fuzerenData).sort((a, b) => {
            const orderA = a[1].order || 999999;
            const orderB = b[1].order || 999999;
            return orderA - orderB;
        });
    }
    
    function buildExportData(fields, fuzerenData, mirrorData) {
        const data = [];
        const headers = fields.map(field => field === 'name' ? '负责人' : field);
        data.push(headers);
        
        const sortedEntries = sortPersonsByOrder(fuzerenData);
        
        sortedEntries.forEach(([operatorId, personData]) => {
            const row = [];
            const mirrorPersonData = mirrorData?.[operatorId];
            
            fields.forEach(field => {
                let value;
                
                if (mirrorPersonData) {
                    if (field === 'name') {
                        value = mirrorPersonData.name !== undefined ? mirrorPersonData.name : personData.name;
                    } else {
                        value = mirrorPersonData.jieguo?.[field] !== undefined 
                            ? mirrorPersonData.jieguo[field] 
                            : personData.jieguo?.[field];
                    }
                } else {
                    value = field === 'name' ? personData.name : personData.jieguo?.[field];
                }
                
                row.push(value === undefined || value === null ? '' : value);
            });
            
            data.push(row);
        });
        
        return data;
    }
    
    return { init };
})();