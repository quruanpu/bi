// 上传模块 - 使用统一方法版（v1.08）
const ShangchuanModule = (function() {
    
    function handleUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.xls';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!file.name.match(/\.(xlsx|xls)$/)) {
                window.showToast('请上传Excel文件。', 'warning');
                return;
            }
            
            readExcelFile(file);
        };
        
        input.click();
    }
    
    function readExcelFile(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                processExcelData(jsonData);
                
            } catch (error) {
                window.showToast('读取文件失败：' + error.message, 'error');
            }
        };
        
        reader.readAsArrayBuffer(file);
    }
    
    function processExcelData(data) {
        if (!data || data.length < 2) {
            window.showToast('Excel文件无有效数据。', 'error');
            return;
        }
        
        const headers = data[0];
        
        if (!headers[0] || headers[0] !== '负责人') {
            window.showToast('第一列必须是"负责人"。', 'error');
            return;
        }
        
        const fields = headers.slice(1).filter(f => f);
        
        if (fields.length === 0) {
            window.showToast('没有找到有效字段。', 'error');
            return;
        }
        
        firebase.database().ref('/fuzeren').once('value', (snapshot) => {
            const existingData = snapshot.val() || {};
            const updates = {};
            let updateCount = 0;
            let newCount = 0;
            
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (!row || !row[0]) continue;
                
                const personName = String(row[0]).trim();
                if (!personName) continue;
                
                let operatorId = findOperatorId(existingData, personName);
                
                if (!operatorId) {
                    operatorId = generateOperatorId();
                    updates[`/fuzeren/${operatorId}/name`] = personName;
                    const maxOrder = FirebaseModule.calculateMaxOrder(existingData, 'operator');
                    updates[`/fuzeren/${operatorId}/order`] = maxOrder + 1000;
                    newCount++;
                }
                
                fields.forEach((field, index) => {
                    const value = row[index + 1];
                    
                    if (value !== undefined && value !== null && value !== '') {
                        updates[`/fuzeren/${operatorId}/jieguo/${field}`] = value;
                        updateCount++;
                    }
                });
            }
            
            if (Object.keys(updates).length > 0) {
                // 使用100-999随机值触发biaozhi
                const randomValue = Math.floor(Math.random() * 900) + 100;
                updates['/peizhi/biaozhi'] = randomValue;
                
                firebase.database().ref().update(updates)
                    .then(() => {
                        const message = `上传成功！更新${updateCount}个字段` +
                                       (newCount > 0 ? `，新增${newCount}个负责人。` : '。');
                        window.showToast(message, 'success');
                    })
                    .catch(error => {
                        window.showToast('保存数据失败：' + error.message, 'error');
                    });
            } else {
                window.showToast('没有需要更新的数据。', 'info');
            }
        });
    }
    
    function findOperatorId(existingData, personName) {
        for (const [operatorId, data] of Object.entries(existingData)) {
            if (data.name === personName) {
                return operatorId;
            }
        }
        return null;
    }
    
    function generateOperatorId() {
        return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    function init() {
        if (typeof XLSX === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            document.head.appendChild(script);
        }
    }
    
    return {
        init,
        handleUpload
    };
})();