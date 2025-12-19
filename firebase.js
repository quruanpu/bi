// Firebase数据库模块 - 统一清理版 (v2.2)
const FirebaseModule = (function() {
    const firebaseConfig = {
        apiKey: "AIzaSyA0FUYw_qt1PRBklf-QvJscHFDh7oLKhb4",
        databaseURL: "https://server-d137e-default-rtdb.asia-southeast1.firebasedatabase.app"
    };

    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    
    let refs = {};
    let isInitialized = false;
    let lastBiaozhiValue = undefined;

    function init(connectionCallback) {
        refs.connection = database.ref('.info/connected');
        refs.fuzeren = database.ref('/fuzeren');
        refs.peizhi = database.ref('/peizhi');
        refs.biaozhi = database.ref('/peizhi/biaozhi');
        refs.gongshi = database.ref('/peizhi/config/bi/gongshi');
        refs.shijian = database.ref('/peizhi/shijian');
        refs.jindu = database.ref('/peizhi/jindu');
        refs.jingxiang = database.ref('/peizhi/jingxiang');
        
        refs.connection.on('value', (snapshot) => connectionCallback(snapshot.val()));
        
        initializeData();
    }

    function initializeData() {
        Promise.all([
            refs.fuzeren.once('value'),
            refs.peizhi.once('value'),
            refs.jingxiang.once('value')
        ]).then(([fuzerenSnapshot, peizhiSnapshot, jingxiangSnapshot]) => {
            const fuzerenData = fuzerenSnapshot.val();
            const peizhiData = peizhiSnapshot.val() || {};
            const jingxiangData = jingxiangSnapshot.val();
            
            lastBiaozhiValue = peizhiData.biaozhi;
            
            const configBi = peizhiData.config?.bi;
            if (!configBi || configBi.gongshi === undefined) {
                database.ref('/peizhi/config/bi/gongshi').set('');
            }
            
            const updates = {};
            const now = new Date();
            
            if (!peizhiData.hasOwnProperty('shijian')) {
                updates['/peizhi/shijian'] = formatDateTime(now);
            }
            
            if (!peizhiData.hasOwnProperty('jindu')) {
                const currentDay = now.getDate() - 1;
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                const percentage = Math.round((currentDay / daysInMonth) * 100);
                updates['/peizhi/jindu'] = `${percentage}%`;
            }
            
            if (Object.keys(updates).length > 0) {
                database.ref().update(updates);
            }
            
            XinxiModule.updateDataTime(
                updates['/peizhi/shijian'] || peizhiData.shijian,
                updates['/peizhi/jindu'] || peizhiData.jindu
            );
            
            checkAndUpdateFieldConfigs(fuzerenData, jingxiangData, peizhiData);
            
            XinxiModule.updateConnectionStatus(true);
            
            if (!isInitialized) {
                setupRealtimeListeners();
                isInitialized = true;
                
                if (typeof TableModule !== 'undefined') {
                    TableModule.init();
                }
                
                setTimeout(() => {
                    if (typeof CaozuoModule !== 'undefined') {
                        CaozuoModule.init();
                    }
                }, 1000);
            }
        });
    }

    function formatDateTime(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    }

    // 统一字段提取逻辑 - 移除name字段强制包含
    function extractAllFields(fuzerenData, jingxiangData) {
        const fieldsSet = new Set();
        
        if (fuzerenData) {
            Object.values(fuzerenData).forEach(person => {
                // name字段和其他字段统一处理 - 只有在数据中存在时才添加
                if (person.name !== undefined) fieldsSet.add('name');
                if (person.jieguo) {
                    Object.keys(person.jieguo).forEach(key => fieldsSet.add(key));
                }
            });
        }
        
        if (jingxiangData) {
            Object.values(jingxiangData).forEach(person => {
                if (person.name !== undefined) fieldsSet.add('name');
                if (person.jieguo) {
                    Object.keys(person.jieguo).forEach(key => fieldsSet.add(key));
                }
            });
        }
        
        return Array.from(fieldsSet);
    }
    
    // 保持原有的calculateMaxOrder - 不移除type参数
    function calculateMaxOrder(data, type) {
        if (type === 'field') {
            const orders = Object.values(data || {}).filter(v => 
                typeof v === 'number' && isFinite(v)
            );
            return orders.length > 0 ? Math.max(...orders) : 0;
        } else if (type === 'operator') {
            const orders = Object.values(data || {}).map(d => d.order || 0);
            return Math.max(...orders, 0);
        }
        return 0;
    }
    
    // 统一字段配置生成
    function generateFieldConfig(fieldName, currentOrder, currentStatus) {
        const updates = {};
        
        if (!currentOrder.hasOwnProperty(fieldName) || 
            currentOrder[fieldName] == null ||
            !isFinite(currentOrder[fieldName])) {
            const maxOrder = calculateMaxOrder(currentOrder, 'field');
            updates[`/peizhi/shunxu/${fieldName}`] = maxOrder + 1;
        }
        
        if (!currentStatus.hasOwnProperty(fieldName) ||
            (currentStatus[fieldName] !== 0 && currentStatus[fieldName] !== 1)) {
            updates[`/peizhi/zhuangtai/${fieldName}`] = 1;
        }
        
        return updates;
    }
    
    function checkAndUpdateFieldConfigs(fuzerenData, jingxiangData, peizhiData) {
        if (!fuzerenData && !jingxiangData) return;
        
        const allFields = extractAllFields(fuzerenData, jingxiangData);
        const currentOrder = peizhiData.shunxu || {};
        const currentStatus = peizhiData.zhuangtai || {};
        const updates = {};
        
        allFields.forEach(field => {
            Object.assign(updates, generateFieldConfig(field, currentOrder, currentStatus));
        });
        
        if (Object.keys(updates).length > 0) {
            database.ref().update(updates);
        }
    }

    function setupRealtimeListeners() {
        refs.biaozhi.on('value', (snapshot) => {
            const biaozhiValue = snapshot.val();
            
            if (lastBiaozhiValue !== undefined && biaozhiValue !== lastBiaozhiValue) {
                const now = new Date();
                const currentDay = now.getDate() - 1;
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                const percentage = Math.round((currentDay / daysInMonth) * 100);
                
                const timeStr = formatDateTime(now);
                const progressStr = `${percentage}%`;
                
                database.ref().update({
                    '/peizhi/shijian': timeStr,
                    '/peizhi/jindu': progressStr
                }).then(() => {
                    XinxiModule.updateDataTime(timeStr, progressStr);
                });
            }
            
            lastBiaozhiValue = biaozhiValue;
            
            if (biaozhiValue !== null) {
                Promise.all([
                    refs.fuzeren.once('value'),
                    refs.peizhi.once('value'),
                    refs.jingxiang.once('value')
                ]).then(([fuzerenSnapshot, peizhiSnapshot, jingxiangSnapshot]) => {
                    checkAndUpdateFieldConfigs(
                        fuzerenSnapshot.val(),
                        jingxiangSnapshot.val(),
                        peizhiSnapshot.val() || {}
                    );
                });
            }
        });
        
        refs.shijian.on('value', (snapshot) => {
            const shijian = snapshot.val();
            if (shijian) {
                refs.jindu.once('value', (jinduSnapshot) => {
                    const jindu = jinduSnapshot.val();
                    if (jindu) {
                        XinxiModule.updateDataTime(shijian, jindu);
                    }
                });
            }
        });
    }

    function reconnect() {
        Object.values(refs).forEach(ref => ref?.off());
        isInitialized = false;
        lastBiaozhiValue = undefined;
        init(...arguments);
    }

    // 统一的清理操作构建函数
    function buildCleanupOperations(options) {
        const {
            fieldToDelete,
            requirements,
            fuzerenData,
            mirrorData,
            configData
        } = options;
        
        const cleanupOps = {};
        
        // 场景1：删除特定字段
        if (fieldToDelete) {
            Object.keys(fuzerenData || {}).forEach(operatorId => {
                if (fieldToDelete === 'name') {
                    if (fuzerenData[operatorId].name !== undefined) {
                        cleanupOps[`/fuzeren/${operatorId}/name`] = null;
                    }
                } else {
                    if (fuzerenData[operatorId].jieguo && 
                        fuzerenData[operatorId].jieguo[fieldToDelete] !== undefined) {
                        cleanupOps[`/fuzeren/${operatorId}/jieguo/${fieldToDelete}`] = null;
                    }
                }
            });
            
            Object.keys(mirrorData || {}).forEach(operatorId => {
                if (fieldToDelete === 'name') {
                    if (mirrorData[operatorId].name !== undefined) {
                        cleanupOps[`/peizhi/jingxiang/${operatorId}/name`] = null;
                    }
                } else {
                    if (mirrorData[operatorId].jieguo && 
                        mirrorData[operatorId].jieguo[fieldToDelete] !== undefined) {
                        cleanupOps[`/peizhi/jingxiang/${operatorId}/jieguo/${fieldToDelete}`] = null;
                    }
                }
            });
            
            cleanupOps[`/peizhi/shunxu/${fieldToDelete}`] = null;
            cleanupOps[`/peizhi/zhuangtai/${fieldToDelete}`] = null;
        }
        // 场景2：根据requirements清理
        else {
            // 清理镜像数据
            if (!requirements) {
                cleanupOps['/peizhi/jingxiang'] = null;
            } else {
                Object.keys(mirrorData || {}).forEach(operatorId => {
                    if (!requirements[operatorId]) {
                        cleanupOps[`/peizhi/jingxiang/${operatorId}`] = null;
                    } else if (mirrorData[operatorId].jieguo) {
                        Object.keys(mirrorData[operatorId].jieguo).forEach(field => {
                            if (!requirements[operatorId].has(field)) {
                                cleanupOps[`/peizhi/jingxiang/${operatorId}/jieguo/${field}`] = null;
                            }
                        });
                    }
                });
            }
            
            // 清理配置
            const shunxu = configData?.shunxu || {};
            const allRequiredFields = new Set();
            if (requirements) {
                Object.values(requirements).forEach(fields => {
                    fields.forEach(f => allRequiredFields.add(f));
                });
            }
            
            Object.keys(shunxu).forEach(field => {
                const inOriginal = checkFieldInOriginal(field, fuzerenData);
                const inRequirements = allRequiredFields.has(field);
                
                if (!inOriginal && !inRequirements) {
                    cleanupOps[`/peizhi/shunxu/${field}`] = null;
                    cleanupOps[`/peizhi/zhuangtai/${field}`] = null;
                }
            });
        }
        
        return cleanupOps;
    }
    
    function checkFieldInOriginal(field, fuzerenData) {
        if (!fuzerenData) return false;
        
        for (const person of Object.values(fuzerenData)) {
            if (field === 'name') {
                if (person.name !== undefined) return true;
            } else {
                if (person.jieguo && person.jieguo[field] !== undefined) return true;
            }
        }
        return false;
    }

    function deleteField(fieldName) {
        Promise.all([
            refs.fuzeren.once('value'),
            refs.jingxiang.once('value')
        ]).then(([fuzerenSnapshot, jingxiangSnapshot]) => {
            const cleanupOps = buildCleanupOperations({
                fieldToDelete: fieldName,
                fuzerenData: fuzerenSnapshot.val() || {},
                mirrorData: jingxiangSnapshot.val() || {}
            });
            
            const randomValue = Math.floor(Math.random() * 900) + 100;
            cleanupOps['/peizhi/biaozhi'] = randomValue;
            
            return database.ref().update(cleanupOps);
        }).then(() => {
            window.showToast(`字段 "${fieldName}" 已删除！`, 'success');
        }).catch(error => {
            window.showToast('删除失败: ' + error.message, 'error');
        });
    }

    function getFormula(callback) {
        database.ref('/peizhi/config/bi/gongshi').once('value', (snapshot) => {
            callback(snapshot.val() || '');
        });
    }

    function saveFormula(formula) {
        return database.ref('/peizhi/config/bi/gongshi').set(formula);
    }

    function getAllFuzerenData(callback) {
        refs.fuzeren.once('value', (snapshot) => {
            callback(snapshot.val());
        });
    }

    return {
        init,
        reconnect,
        deleteField,
        getBiaozhiRef: () => refs.biaozhi,
        getFormula,
        saveFormula,
        getAllFuzerenData,
        extractAllFields,
        calculateMaxOrder,
        generateFieldConfig,
        buildCleanupOperations
    };
})();