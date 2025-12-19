// 计算算术模块 - 纯计算逻辑 (v4.0)
const SuanshuModule = (function() {
    
    // 核心计算函数 - 只返回成功计算的字段
    function calculateForOperator(formulas, personData) {
        const results = {};
        const context = {
            name: personData.name,
            ...(personData.jieguo || {})
        };
        
        formulas.forEach(({ fieldName, expression }) => {
            Object.assign(context, results);
            
            const fieldMapping = JiexiModule.createFieldMapping(expression, context);
            const requiredFields = JiexiModule.extractFields(expression);
            
            const allFieldsAvailable = requiredFields.every(field => 
                fieldMapping[field] !== undefined
            );
            
            if (allFieldsAvailable) {
                const evalExpression = JiexiModule.replaceFields(expression, fieldMapping);
                const evalResult = JiexiModule.safeEvaluate(evalExpression);
                
                if (evalResult.success && 
                    evalResult.result !== undefined && 
                    evalResult.result !== null && 
                    !isNaN(evalResult.result)) {
                    results[fieldName] = evalResult.result;
                }
            }
        });
        
        return results;
    }
    
    // 分析镜像需求 - 只记录成功计算的字段
    function analyzeMirrorRequirements(mirrorGroups, fuzerenData) {
        const requirements = {};
        
        try {
            const generalMirrorGroup = mirrorGroups.find(g => g.target === '通用');
            if (generalMirrorGroup) {
                const parseResult = JiexiModule.parseFormulas(generalMirrorGroup.content);
                if (!parseResult.success) {
                    return { success: false, message: parseResult.message };
                }
                
                const requiredFields = new Set();
                const resultFields = new Set();
                
                parseResult.data.forEach(formula => {
                    resultFields.add(formula.fieldName);
                    JiexiModule.extractFields(formula.expression).forEach(field => {
                        if (field !== 'name') requiredFields.add(field);
                    });
                });
                
                Object.keys(fuzerenData).forEach(operatorId => {
                    requirements[operatorId] = {
                        targets: resultFields,     // 目标字段
                        dependencies: requiredFields  // 依赖字段
                    };
                });
            }
            
            const personalMirrorGroups = mirrorGroups.filter(g => g.target !== '通用');
            personalMirrorGroups.forEach(group => {
                const operatorId = findOperatorByName(fuzerenData, group.target);
                if (!operatorId) return;
                
                const parseResult = JiexiModule.parseFormulas(group.content);
                if (!parseResult.success) return;
                
                const targets = new Set();
                const dependencies = new Set();
                
                parseResult.data.forEach(formula => {
                    targets.add(formula.fieldName);
                    JiexiModule.extractFields(formula.expression).forEach(field => {
                        if (field !== 'name') dependencies.add(field);
                    });
                });
                
                if (!requirements[operatorId]) {
                    requirements[operatorId] = { targets, dependencies };
                } else {
                    targets.forEach(f => requirements[operatorId].targets.add(f));
                    dependencies.forEach(f => requirements[operatorId].dependencies.add(f));
                }
            });
            
            return { success: true, requirements };
        } catch (error) {
            return { success: false, message: '镜像需求分析失败：' + error.message };
        }
    }
    
    // 创建本地镜像
    function createLocalMirror(fuzerenData, requirements) {
        const localMirror = {};
        
        Object.entries(requirements).forEach(([operatorId, req]) => {
            const personData = fuzerenData[operatorId];
            if (!personData) return;
            
            localMirror[operatorId] = {
                name: personData.name,
                order: personData.order || 999999,
                jieguo: personData.jieguo ? { ...personData.jieguo } : {}
            };
        });
        
        return localMirror;
    }
    
    // 执行镜像计算 - 只保存成功的结果
    function performLocalCalculations(mirrorGroups, localMirror, requirements) {
        const results = {};
        
        // 通用镜像计算
        const generalGroup = mirrorGroups.find(g => g.target === '通用');
        if (generalGroup) {
            const parseResult = JiexiModule.parseFormulas(generalGroup.content);
            if (!parseResult.success) {
                throw new Error(parseResult.message);
            }
            
            const availableFields = new Set(['name']);
            Object.values(localMirror).forEach(person => {
                if (person.jieguo) {
                    Object.keys(person.jieguo).forEach(field => availableFields.add(field));
                }
            });
            
            const analysisResult = JiexiModule.analyzeAndSortFormulas(
                parseResult.data, 
                Array.from(availableFields)
            );
            
            if (!analysisResult.success) {
                const missingFields = analysisResult.errors.map(error => 
                    error.replace(/^字段 ".+?": 缺少 /, '')
                ).join(', ');
                throw new Error(`#通用，缺失"${missingFields}"。`);
            }
            
            Object.keys(requirements).forEach(operatorId => {
                if (!localMirror[operatorId]) return;
                
                const personResults = calculateForOperator(
                    analysisResult.sortedFormulas, 
                    localMirror[operatorId]
                );
                
                // 只保存有结果的负责人
                if (Object.keys(personResults).length > 0) {
                    results[operatorId] = personResults;
                    Object.assign(localMirror[operatorId].jieguo, personResults);
                }
            });
        }
        
        // 个性化镜像计算
        const personalGroups = mirrorGroups.filter(g => g.target !== '通用');
        personalGroups.forEach(group => {
            const operatorId = findOperatorByName(localMirror, group.target);
            if (!operatorId || !localMirror[operatorId]) return;
            
            const parseResult = JiexiModule.parseFormulas(group.content);
            if (!parseResult.success) {
                console.error(`#${group.target} 解析失败：${parseResult.message}`);
                return;
            }
            
            const personalContext = localMirror[operatorId].jieguo || {};
            const availableFields = Object.keys(personalContext).concat('name');
            
            const analysisResult = JiexiModule.analyzeAndSortFormulas(parseResult.data, availableFields);
            if (!analysisResult.success) {
                const missingFields = analysisResult.errors.map(error => 
                    error.replace(/^字段 ".+?": 缺少 /, '')
                ).join(', ');
                console.error(`#${group.target}，缺失"${missingFields}"。`);
                return;
            }
            
            const personalResults = calculateForOperator(
                analysisResult.sortedFormulas, 
                localMirror[operatorId]
            );
            
            // 只合并有结果的字段
            if (Object.keys(personalResults).length > 0) {
                if (!results[operatorId]) {
                    results[operatorId] = {};
                }
                Object.assign(results[operatorId], personalResults);
            }
        });
        
        return results;
    }
    
    // 执行普通计算逻辑
    function executeNormalCalculationLogic(normalGroups, fuzerenData) {
        const workingData = JSON.parse(JSON.stringify(fuzerenData));
        const allResults = {};
        
        console.log('开始执行普通计算。');
        
        const generalGroup = normalGroups.find(g => g.target === '通用');
        if (generalGroup) {
            const parseResult = JiexiModule.parseFormulas(generalGroup.content);
            if (!parseResult.success) {
                throw new Error(parseResult.message);
            }
            
            const existingFields = FirebaseModule.extractAllFields(fuzerenData);
            const analysisResult = JiexiModule.analyzeAndSortFormulas(parseResult.data, existingFields);
            
            if (!analysisResult.success) {
                throw new Error('分析失败：' + analysisResult.errors.join('; '));
            }
            
            console.log(`通用公式：${analysisResult.sortedFormulas.length} 个字段。`);
            
            Object.keys(workingData).forEach(operatorId => {
                const results = calculateForOperator(analysisResult.sortedFormulas, workingData[operatorId]);
                if (Object.keys(results).length > 0) {
                    allResults[operatorId] = results;
                    if (!workingData[operatorId].jieguo) {
                        workingData[operatorId].jieguo = {};
                    }
                    Object.assign(workingData[operatorId].jieguo, results);
                }
            });
        }
        
        const personalGroups = normalGroups.filter(g => g.target !== '通用');
        personalGroups.forEach(group => {
            const operatorId = findOperatorByName(fuzerenData, group.target);
            if (!operatorId) {
                console.log(`跳过不存在的负责人：${group.target}。`);
                return;
            }
            
            const parseResult = JiexiModule.parseFormulas(group.content);
            if (!parseResult.success) {
                console.error(`${group.target} 解析失败：${parseResult.message}`);
                return;
            }
            
            const personalContext = workingData[operatorId].jieguo || {};
            const availableFields = Object.keys(personalContext).concat('name');
            
            const analysisResult = JiexiModule.analyzeAndSortFormulas(parseResult.data, availableFields);
            if (!analysisResult.success) {
                const missingFields = analysisResult.errors.map(error => 
                    error.replace(/^字段 ".+?": 缺少 /, '')
                ).join(', ');
                console.error(`@${group.target}，缺失"${missingFields}"。`);
                return;
            }
            
            const personalResults = calculateForOperator(analysisResult.sortedFormulas, workingData[operatorId]);
            
            if (Object.keys(personalResults).length > 0) {
                if (!allResults[operatorId]) {
                    allResults[operatorId] = {};
                }
                Object.assign(allResults[operatorId], personalResults);
                Object.assign(workingData[operatorId].jieguo, personalResults);
            }
        });
        
        return allResults;
    }
    
    function findOperatorByName(data, name) {
        for (const [operatorId, personData] of Object.entries(data)) {
            if (personData.name === name) {
                return operatorId;
            }
        }
        return null;
    }
    
    return {
        calculateForOperator,
        analyzeMirrorRequirements,
        createLocalMirror,
        performLocalCalculations,
        executeNormalCalculationLogic,
        findOperatorByName
    };
})();