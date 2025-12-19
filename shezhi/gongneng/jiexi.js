// 解析模块 - 支持镜像计算版 (v4.0)
const JiexiModule = (function() {
    
    // 支持的运算符
    const OPERATORS = ['+', '-', '*', '/', '(', ')', ' '];
    
    // 解析分组公式文本 - 支持普通(@)和镜像(#)格式
    function parseGroupedFormulas(text) {
        const cleanText = text.trim();
        if (!cleanText) {
            return { success: false, message: '请输入计算公式!' };
        }
        
        const normalGroups = [];
        const mirrorGroups = [];
        
        // 解析普通公式 (@)
        const normalRegex = /@([^{]+)\{([^}]*)\}/g;
        let match;
        
        while ((match = normalRegex.exec(cleanText)) !== null) {
            const targetString = match[1].trim();
            const content = match[2].trim();
            
            if (!content) continue;
            
            const targets = targetString.split('@').map(t => t.trim()).filter(t => t);
            
            targets.forEach(target => {
                normalGroups.push({ target, content, type: 'normal' });
            });
        }
        
        // 解析镜像公式 (#)
        const mirrorRegex = /#([^{]+)\{([^}]*)\}/g;
        
        while ((match = mirrorRegex.exec(cleanText)) !== null) {
            const targetString = match[1].trim();
            const content = match[2].trim();
            
            if (!content) continue;
            
            const targets = targetString.split('#').map(t => t.trim()).filter(t => t);
            
            targets.forEach(target => {
                mirrorGroups.push({ target, content, type: 'mirror' });
            });
        }
        
        const totalGroups = normalGroups.length + mirrorGroups.length;
        
        if (totalGroups === 0) {
            return { 
                success: false, 
                message: '请使用正确格式: @通用{公式} 或 #负责人名{公式};' 
            };
        }
        
        // 检查普通公式必须包含通用分组
        if (normalGroups.length > 0) {
            const hasGeneral = normalGroups.some(g => g.target === '通用');
            if (!hasGeneral) {
                return {
                    success: false,
                    message: '普通公式必须包含 @通用{} 分组;'
                };
            }
        }
        
        const allGroups = [...normalGroups, ...mirrorGroups];
        
        return { 
            success: true, 
            groups: allGroups,
            normalGroups,
            mirrorGroups
        };
    }
    
    // 解析单组公式 - 支持重复定义
    function parseFormulas(text) {
        const cleanText = text.trim();
        if (!cleanText) {
            return { success: false, message: '公式内容为空!' };
        }
        
        const formulaLines = cleanText.split(';').filter(line => line.trim());
        
        if (formulaLines.length === 0) {
            return { success: false, message: '未找到有效公式!' };
        }
        
        const formulas = [];
        
        for (let i = 0; i < formulaLines.length; i++) {
            const line = formulaLines[i].trim();
            const colonIndex = line.indexOf(':');
            
            if (colonIndex === -1) {
                return { 
                    success: false, 
                    message: `第${i+1}个公式格式错误: ${line}` 
                };
            }
            
            const fieldName = line.substring(0, colonIndex).trim();
            const expression = line.substring(colonIndex + 1).trim();
            
            if (!fieldName || !expression) {
                return { 
                    success: false, 
                    message: `第${i+1}个公式不完整!` 
                };
            }
            
            if (!isValidFieldName(fieldName)) {
                return { 
                    success: false, 
                    message: `字段名 "${fieldName}" 格式不正确!` 
                };
            }
            
            formulas.push({ fieldName, expression });
        }
        
        return { success: true, data: formulas };
    }
    
    // 验证字段名
    function isValidFieldName(fieldName) {
        return /^[\u4e00-\u9fff\w]+$/.test(fieldName);
    }
    
    // 提取表达式中的字段
    function extractFields(expression) {
        const fields = [];
        const regex = /[\u4e00-\u9fff\w]+/g;
        let match;
        
        while ((match = regex.exec(expression)) !== null) {
            if (!/^\d+(\.\d+)?$/.test(match[0])) {
                fields.push(match[0]);
            }
        }
        
        return [...new Set(fields)].sort((a, b) => b.length - a.length);
    }
    
    // 分阶段分析和排序公式
    function analyzeAndSortFormulas(formulas, availableFields) {
        const stages = [];
        const definedFields = new Set();
        let currentStage = [];
        
        formulas.forEach(formula => {
            if (definedFields.has(formula.fieldName)) {
                if (currentStage.length > 0) {
                    stages.push(currentStage);
                    currentStage = [];
                }
            }
            
            currentStage.push(formula);
            definedFields.add(formula.fieldName);
        });
        
        if (currentStage.length > 0) {
            stages.push(currentStage);
        }
        
        const allSortedFormulas = [];
        const allAvailableFields = new Set(availableFields);
        
        for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
            const stage = stages[stageIndex];
            const stageResult = analyzeStage(stage, Array.from(allAvailableFields));
            
            if (!stageResult.success) {
                return stageResult;
            }
            
            allSortedFormulas.push(...stageResult.sortedFormulas);
            
            stageResult.sortedFormulas.forEach(f => {
                allAvailableFields.add(f.fieldName);
            });
        }
        
        return { 
            success: true, 
            sortedFormulas: allSortedFormulas,
            stages: stages.length
        };
    }
    
    // 分析单个阶段
    function analyzeStage(formulas, availableFields) {
        const dependencies = {};
        const errors = [];
        const formulaMap = {};
        
        formulas.forEach(({ fieldName, expression }) => {
            formulaMap[fieldName] = expression;
        });
        
        formulas.forEach(({ fieldName, expression }) => {
            const usedFields = extractFields(expression);
            const missingFields = [];
            
            usedFields.forEach(field => {
                if (!availableFields.includes(field) && !formulaMap[field]) {
                    missingFields.push(field);
                }
            });
            
            if (missingFields.length > 0) {
                errors.push(`字段 "${fieldName}": 缺少 ${missingFields.join(', ')}`);
            } else {
                dependencies[fieldName] = usedFields.filter(field => 
                    formulaMap[field] && field !== fieldName
                );
            }
        });
        
        if (errors.length > 0) {
            return { success: false, errors };
        }
        
        const circularCheck = checkCircularDependency(dependencies);
        if (circularCheck.hasCircular) {
            return { 
                success: false, 
                errors: [`循环依赖: ${circularCheck.cycle.join(' → ')}`]
            };
        }
        
        const sortedFormulas = topologicalSort(formulas, dependencies);
        
        return { 
            success: true, 
            sortedFormulas
        };
    }
    
    // 拓扑排序
    function topologicalSort(formulas, dependencies) {
        const sorted = [];
        const visited = new Set();
        
        function visit(fieldName) {
            if (visited.has(fieldName)) return;
            visited.add(fieldName);
            
            const deps = dependencies[fieldName] || [];
            deps.forEach(dep => visit(dep));
            
            const formula = formulas.find(f => f.fieldName === fieldName);
            if (formula) {
                sorted.push(formula);
            }
        }
        
        formulas.forEach(({ fieldName }) => visit(fieldName));
        return sorted;
    }
    
    // 检查循环依赖
    function checkCircularDependency(dependencies) {
        const visited = new Set();
        const recursionStack = new Set();
        
        function dfs(fieldName) {
            if (recursionStack.has(fieldName)) {
                return { hasCircular: true, cycle: Array.from(recursionStack) };
            }
            
            if (visited.has(fieldName)) {
                return { hasCircular: false };
            }
            
            visited.add(fieldName);
            recursionStack.add(fieldName);
            
            const deps = dependencies[fieldName] || [];
            for (const dep of deps) {
                if (dependencies[dep]) {
                    const result = dfs(dep);
                    if (result.hasCircular) {
                        return result;
                    }
                }
            }
            
            recursionStack.delete(fieldName);
            return { hasCircular: false };
        }
        
        for (const fieldName of Object.keys(dependencies)) {
            const result = dfs(fieldName);
            if (result.hasCircular) {
                return result;
            }
        }
        
        return { hasCircular: false };
    }
    
    // 创建字段映射
    function createFieldMapping(expression, context) {
        const fields = extractFields(expression);
        const mapping = {};
        
        for (const field of fields) {
            const value = context[field];
            
            if (value === undefined || value === null) {
                continue;
            }
            
            let numValue;
            if (typeof value === 'number') {
                numValue = value;
            } else if (typeof value === 'string') {
                numValue = parseFloat(value.replace(/[,，\s]/g, ''));
            } else {
                numValue = parseFloat(value);
            }
            
            if (!isNaN(numValue) && isFinite(numValue)) {
                mapping[field] = numValue;
            }
        }
        
        return mapping;
    }
    
    // 精确替换字段
    function replaceFields(expression, fieldMapping) {
        if (!expression || Object.keys(fieldMapping).length === 0) {
            return expression;
        }
        
        const fields = Object.keys(fieldMapping).sort((a, b) => b.length - a.length);
        let result = expression;
        
        for (const field of fields) {
            const regex = new RegExp(`(?<![\\u4e00-\\u9fff\\w])${field}(?![\\u4e00-\\u9fff\\w])`, 'g');
            result = result.replace(regex, `(${fieldMapping[field]})`);
        }
        
        return result;
    }
    
    // 安全求值
    function safeEvaluate(expression) {
        try {
            if (!/^[\d\s+\-*/().]+$/.test(expression)) {
                return { success: false, error: '表达式包含不安全字符!' };
            }
            
            let count = 0;
            for (const char of expression) {
                if (char === '(') count++;
                if (char === ')') count--;
                if (count < 0) return { success: false, error: '括号不匹配!' };
            }
            if (count !== 0) return { success: false, error: '括号不匹配!' };
            
            const result = Function('"use strict"; return (' + expression + ')')();
            
            if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
                return { success: false, error: '计算结果无效!' };
            }
            
            return { success: true, result };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    return {
        parseGroupedFormulas,
        parseFormulas,
        analyzeAndSortFormulas,
        extractFields,
        createFieldMapping,
        replaceFields,
        safeEvaluate
    };
})();