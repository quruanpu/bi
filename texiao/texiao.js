// 加载特效模块 - 修复快速更新版（v1.06）
const TexiaoModule = (function() {
    let isLoading = true;
    
    // 优雅的引导语
    const loadingPhrases = [
        '穿越数字星河，寻找智慧之光......',
        '在比特海洋中，捕获思想的浪花......',
        '聆听代码的诗歌，等待灵感降临......',
        '漫步云端之上，采撷数据之花......',
        '时光机正在启动，即将抵达未来......',
        '量子态正在坍缩，真理即将显现......',
        '跨越虚拟边界，连接无限可能......'
    ];
    
    function init() {
        // 显示当前时间
        showDateTime();
        // 加载网络语录
        loadRandomQuote();
    }
    
    function showDateTime() {
        const dateTimeElement = document.getElementById('loadingDateTime');
        if (!dateTimeElement) return;
        
        const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const weekDay = weekDays[now.getDay()];
        
        dateTimeElement.textContent = `${year}/${month}/${day} ${hours}:${minutes}:${seconds} ${weekDay}`;
    }
    
    async function loadRandomQuote() {
        const statusElement = document.querySelector('.status-text');
        if (!statusElement) return;
        
        // 显示随机的优雅引导语
        const randomPhrase = loadingPhrases[Math.floor(Math.random() * loadingPhrases.length)];
        statusElement.textContent = randomPhrase;
        
        // API列表（按优先级排序）
        const apis = [
            {
                url: 'https://v1.hitokoto.cn/?c=i&c=k&c=d&encode=json',
                parser: (data) => data.hitokoto
            },
            {
                url: 'https://api.uomg.com/api/rand.qinghua?format=json',
                parser: (data) => data.content
            },
            {
                url: 'https://saying.api.azwcl.com/saying/get',
                parser: (data) => data.data && data.data.content
            }
        ];
        
        // 尝试各个API
        for (const api of apis) {
            try {
                const response = await fetch(api.url, {
                    method: 'GET',
                    mode: 'cors',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const quote = api.parser(data);
                    
                    if (quote) {
                        // 直接更新，无延迟
                        statusElement.textContent = quote;
                        return;
                    }
                }
            } catch (error) {
                console.log(`API ${api.url} 失败，尝试下一个!`);
            }
        }
        
        // 所有API都失败，保持引导语
        console.log('所有语录API失败，保持引导语!');
    }
    
    function hide() {
        if (!isLoading) return;
        
        isLoading = false;
        const overlay = document.getElementById('loadingOverlay');
        
        if (overlay) {
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.remove();
            }, 800);
        }
    }
    
    return {
        init,
        hide
    };
})();

// 立即初始化显示时间和语录
TexiaoModule.init();