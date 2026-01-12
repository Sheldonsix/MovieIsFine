// ==UserScript==
// @name         MovieIsFine - 豆瓣电影分级显示
// @namespace    https://movieisfine.com/
// @version      1.0.0
// @description  在豆瓣电影页面显示电影分级信息（从 MovieIsFine 数据库获取）
// @author       MovieIsFine
// @match        https://movie.douban.com/subject/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      localhost
// @connect      movieisfine.com
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ============================================================
    // 配置区域
    // ============================================================

    // API 基础地址（可通过 GM_setValue 动态配置）
    // 开发环境: http://localhost:3000
    // 生产环境: https://movieisfine.com
    const DEFAULT_API_BASE_URL = 'http://localhost:3000';

    /**
     * 获取 API 基础地址
     */
    function getApiBaseUrl() {
        return GM_getValue('apiBaseUrl', DEFAULT_API_BASE_URL);
    }

    // ============================================================
    // 工具函数
    // ============================================================

    /**
     * 从当前页面 URL 提取豆瓣 ID
     * @returns {string|null} 豆瓣 ID
     */
    function getDoubanIdFromUrl() {
        const match = window.location.pathname.match(/\/subject\/(\d+)/);
        return match ? match[1] : null;
    }

    /**
     * 检查分级信息是否已存在（避免重复插入）
     * @returns {boolean}
     */
    function isRatingAlreadyInserted() {
        return document.querySelector('.movieisfine-rating') !== null;
    }

    // ============================================================
    // API 请求
    // ============================================================

    /**
     * 获取电影分级信息
     * @param {string} doubanId 豆瓣 ID
     * @returns {Promise<{doubanId: string, contentRatingZh: string|null}|null>}
     */
    function fetchContentRating(doubanId) {
        const apiBaseUrl = getApiBaseUrl();

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${apiBaseUrl}/api/movie/${doubanId}/content-rating`,
                responseType: 'json',
                timeout: 10000,
                onload: function(response) {
                    if (response.status === 200) {
                        resolve(response.response);
                    } else if (response.status === 404) {
                        // 电影不存在于数据库中，静默处理
                        resolve(null);
                    } else {
                        reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
                    }
                },
                onerror: function() {
                    reject(new Error('网络请求失败'));
                },
                ontimeout: function() {
                    reject(new Error('请求超时'));
                }
            });
        });
    }

    // ============================================================
    // DOM 操作
    // ============================================================

    /**
     * 在电影信息区域插入分级信息
     * 样式与豆瓣电影页面的"电影信息"保持一致
     * @param {string} contentRatingZh 分级信息（中文）
     */
    function insertContentRating(contentRatingZh) {
        if (!contentRatingZh) {
            return;
        }

        // 避免重复插入
        if (isRatingAlreadyInserted()) {
            return;
        }

        const infoDiv = document.getElementById('info');
        if (!infoDiv) {
            console.warn('[MovieIsFine] 未找到 #info 元素');
            return;
        }

        // 创建分级信息行
        // 豆瓣电影信息区域的标签使用 span.pl 类
        const ratingLabel = document.createElement('span');
        ratingLabel.className = 'pl movieisfine-rating';
        ratingLabel.textContent = '分级:';

        // 分级内容使用空格分隔
        const ratingValue = document.createTextNode(' ' + contentRatingZh);

        // 换行符
        const br = document.createElement('br');

        // 查找插入位置
        // 优先在 "IMDb" 行之后插入，如果没有则在 info 区域最后插入
        const insertPosition = findInsertPosition(infoDiv);

        if (insertPosition) {
            // 在指定位置之前插入
            infoDiv.insertBefore(ratingLabel, insertPosition);
            infoDiv.insertBefore(ratingValue, insertPosition);
            infoDiv.insertBefore(br, insertPosition);
        } else {
            // 在 info 区域最后插入
            infoDiv.appendChild(ratingLabel);
            infoDiv.appendChild(ratingValue);
            infoDiv.appendChild(br);
        }
    }

    /**
     * 查找合适的插入位置
     * @param {HTMLElement} infoDiv
     * @returns {Node|null} 插入位置节点，null 表示追加到末尾
     */
    function findInsertPosition(infoDiv) {
        const allSpans = infoDiv.querySelectorAll('span.pl');

        for (const span of allSpans) {
            const text = span.textContent.trim();
            // 查找 IMDb 行
            if (text === 'IMDb:' || text === 'IMDb链接:') {
                // 找到 IMDb 行后的换行符
                let nextElement = span.nextSibling;
                while (nextElement && nextElement.nodeName !== 'BR') {
                    nextElement = nextElement.nextSibling;
                }
                // 返回换行符之后的元素作为插入点
                if (nextElement && nextElement.nextSibling) {
                    return nextElement.nextSibling;
                }
                break;
            }
        }

        return null;
    }

    // ============================================================
    // 主逻辑
    // ============================================================

    /**
     * 主函数
     */
    async function main() {
        // 提取豆瓣 ID
        const doubanId = getDoubanIdFromUrl();
        if (!doubanId) {
            return;
        }

        // 避免重复执行
        if (isRatingAlreadyInserted()) {
            return;
        }

        try {
            const data = await fetchContentRating(doubanId);
            if (data && data.contentRatingZh) {
                insertContentRating(data.contentRatingZh);
            }
        } catch (error) {
            // 静默处理错误，仅在控制台输出
            console.debug('[MovieIsFine] 获取分级信息失败:', error.message);
        }
    }

    // 执行主函数
    main();
})();
