// 计算操作模块 - 优化版 (v4.0)
const CaozuoModule = (function() {
    let biaozhiRef = null;
    let isCalculating = false;
    
    function init() {
        biaozhiRef = FirebaseModule.getBiaozhiRef();
        
        // 启动时无条件检查并清理
        FirebaseModule.getFormula(executeCalculation);
        
        // 监听biaozhi变化
        biaozhiRef.on('value', () => {
            FirebaseModule.getFormula(executeCalculation);
        });
    }
    
    function executeCalculation(formulaText) {
        if (isCalculating) return;
        
        isCalculating = true;
        
        if (!formulaText || !formulaText.trim()) {
            cleanupAllData()
                .then(() => {
                    isCalculating = false;
                    console.log('镜像数据已清理。');
                })
                .catch(error => {
                    isCalculating = false;
                    console.error('清理失败：', error);
                });
            return;
        }
        
        const groupResult = JiexiModule.parseGroupedFormulas(formulaText);
        if (!groupResult.success) {
            isCalculating = false;
            window.showToast(groupResult.message, 'error');
            return;
        }
        
        FirebaseModule.getAllFuzerenData((fuzerenData) => {
            if (!fuzerenData) {
                isCalculating = false;
                window.showToast('暂无数据，无法计算。', 'error');
                return;
            }
            
            executeGroupedCalculation(groupResult, fuzerenData);
        });
    }
    
    async function cleanupAllData() {
        const [mirrorSnapshot, configSnapshot, fuzerenSnapshot] = await Promise.all([
            firebase.database().ref('/peizhi/jingxiang').once('value'),
            firebase.database().ref('/peizhi').once('value'),
            new Promise(resolve => FirebaseModule.getAllFuzerenData(resolve))
        ]);
        
        const cleanupOps = FirebaseModule.buildCleanupOperations({
            requirements: null,
            fuzerenData: fuzerenSnapshot || {},
            mirrorData: mirrorSnapshot.val() || {},
            configData: configSnapshot.val() || {}
        });
        
        if (Object.keys(cleanupOps).length > 0) {
            return firebase.database().ref().update(cleanupOps);
        }
    }
    
    function executeGroupedCalculation(groupResult, fuzerenData) {
        const { normalGroups, mirrorGroups } = groupResult;
        let successCount = 0;
        
        if (normalGroups.length > 0) {
            executeNormalCalculation(normalGroups, fuzerenData)
                .then((result) => {
                    successCount += result?.successCount || 0;
                    
                    if (mirrorGroups.length > 0) {
                        return executeMirrorCalculation(mirrorGroups, result.updatedData || fuzerenData);
                    } else {
                        return firebase.database().ref('/peizhi/jingxiang').remove()
                            .then(() => ({ successCount: 0 }));
                    }
                })
                .then((mirrorResult) => {
                    successCount += mirrorResult?.successCount || 0;
                    isCalculating = false;
                    window.showToast(`计算完毕！${successCount}个字段成功。`, 'success');
                })
                .catch(error => {
                    isCalculating = false;
                    window.showToast('计算失败：' + error.message, 'error');
                });
        } else if (mirrorGroups.length > 0) {
            executeMirrorCalculation(mirrorGroups, fuzerenData)
                .then((result) => {
                    isCalculating = false;
                    window.showToast(`计算完毕！${result?.successCount || 0}个字段成功。`, 'success');
                })
                .catch(error => {
                    isCalculating = false;
                    window.showToast('计算失败：' + error.message, 'error');
                });
        } else {
            firebase.database().ref('/peizhi/jingxiang').remove()
                .then(() => {
                    isCalculating = false;
                    window.showToast('计算完毕！', 'warning');
                });
        }
    }
    
    function executeNormalCalculation(normalGroups, fuzerenData) {
        return new Promise((resolve, reject) => {
            try {
                const allResults = SuanshuModule.executeNormalCalculationLogic(normalGroups, fuzerenData);
                const updatedFuzerenData = JSON.parse(JSON.stringify(fuzerenData));
                
                Object.entries(allResults).forEach(([operatorId, fields]) => {
                    if (!updatedFuzerenData[operatorId].jieguo) {
                        updatedFuzerenData[operatorId].jieguo = {};
                    }
                    Object.assign(updatedFuzerenData[operatorId].jieguo, fields);
                });
                
                saveNormalResults(allResults, fuzerenData)
                    .then((saveResult) => resolve({ ...saveResult, updatedData: updatedFuzerenData }))
                    .catch(reject);
            } catch (error) {
                reject(error);
            }
        });
    }
    
    async function executeMirrorCalculation(mirrorGroups, fuzerenData) {
        const mirrorAnalysis = SuanshuModule.analyzeMirrorRequirements(mirrorGroups, fuzerenData);
        if (!mirrorAnalysis.success) {
            throw new Error(mirrorAnalysis.message);
        }
        
        try {
            const [mirrorSnapshot, configSnapshot] = await Promise.all([
                firebase.database().ref('/peizhi/jingxiang').once('value'),
                firebase.database().ref('/peizhi').once('value')
            ]);
            
            const localMirror = SuanshuModule.createLocalMirror(fuzerenData, mirrorAnalysis.requirements);
            const calculationResults = SuanshuModule.performLocalCalculations(
                mirrorGroups, 
                localMirror, 
                mirrorAnalysis.requirements
            );
            
            // 转换requirements格式用于清理
            const cleanupRequirements = {};
            Object.entries(calculationResults).forEach(([operatorId, fields]) => {
                cleanupRequirements[operatorId] = new Set(Object.keys(fields));
            });
            
            const cleanupOps = FirebaseModule.buildCleanupOperations({
                requirements: cleanupRequirements,
                fuzerenData,
                mirrorData: mirrorSnapshot.val() || {},
                configData: configSnapshot.val() || {}
            });
            
            // 构建镜像更新 - 只更新有值的字段
            const mirrorUpdates = {};
            Object.entries(calculationResults).forEach(([operatorId, fields]) => {
                Object.entries(fields).forEach(([field, value]) => {
                    mirrorUpdates[`/peizhi/jingxiang/${operatorId}/jieguo/${field}`] = value;
                });
            });
            
            // 新字段配置
            const configUpdates = {};
            const allNewFields = new Set();
            Object.values(calculationResults).forEach(fields => {
                Object.keys(fields).forEach(field => allNewFields.add(field));
            });
            
            if (allNewFields.size > 0) {
                const peizhiData = configSnapshot.val() || {};
                allNewFields.forEach(fieldName => {
                    Object.assign(configUpdates, FirebaseModule.generateFieldConfig(
                        fieldName,
                        peizhiData.shunxu || {},
                        peizhiData.zhuangtai || {}
                    ));
                });
            }
            
            const allUpdates = { ...cleanupOps, ...mirrorUpdates, ...configUpdates };
            
            if (Object.keys(allUpdates).length > 0) {
                await firebase.database().ref().update(allUpdates);
            }
            
            let successCount = 0;
            Object.values(calculationResults).forEach(fields => {
                successCount += Object.keys(fields).length;
            });
            
            return { successCount };
        } catch (error) {
            throw error;
        }
    }
    
    function saveNormalResults(results, originalData) {
        return new Promise((resolve, reject) => {
            const updates = {};
            
            Object.entries(results).forEach(([operatorId, fields]) => {
                Object.entries(fields).forEach(([field, value]) => {
                    updates[`/fuzeren/${operatorId}/jieguo/${field}`] = value;
                });
            });
            
            if (Object.keys(updates).length === 0) {
                resolve({ successCount: 0 });
                return;
            }
            
            const existingFields = FirebaseModule.extractAllFields(originalData);
            const newFields = new Set();
            let successCount = 0;
            
            Object.values(results).forEach(fields => {
                Object.keys(fields).forEach(field => {
                    successCount++;
                    if (!existingFields.includes(field)) {
                        newFields.add(field);
                    }
                });
            });
            
            if (newFields.size > 0) {
                firebase.database().ref('/peizhi').once('value').then(snapshot => {
                    const peizhiData = snapshot.val() || {};
                    
                    newFields.forEach(fieldName => {
                        Object.assign(updates, FirebaseModule.generateFieldConfig(
                            fieldName,
                            peizhiData.shunxu || {},
                            peizhiData.zhuangtai || {}
                        ));
                    });
                    
                    return firebase.database().ref().update(updates);
                }).then(() => resolve({ successCount })).catch(reject);
            } else {
                firebase.database().ref().update(updates)
                    .then(() => resolve({ successCount }))
                    .catch(reject);
            }
        });
    }
    
    return {
        init
    };
})();