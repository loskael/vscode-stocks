import * as vscode from 'vscode'
import * as https from 'https'
import * as http from 'http'
import * as iconv from 'iconv-lite'

let items: Map<string, vscode.StatusBarItem>
export function activate(context: vscode.ExtensionContext) {
    items = new Map<string, vscode.StatusBarItem>();

    refresh()
    setInterval(refresh, 60 * 1e3)
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(refresh))
}

// this method is called when your extension is deactivated
export function deactivate() {
}

function refresh(): void {
    const config = vscode.workspace.getConfiguration()
    const configuredSymbols = config.get('vscode-stocks.stockSymbols', [])
        .map(symbol => symbol.toUpperCase())

    if (!arrayEq(configuredSymbols, Array.from(items.keys()))) {
        cleanup()
        fillEmpty(configuredSymbols)
    }

    refreshSymbols(configuredSymbols)
}

function fillEmpty(symbols: string[]): void {
    symbols
        .forEach((symbol, i) => {
            // Enforce ordering with priority
            const priority = symbols.length - i
            const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, priority)
            item.text = `${symbol}: $…`
            item.show()
            items.set(symbol, item)
        })
}

function cleanup(): void {
    items.forEach(item => {
        item.hide()
        item.dispose()
    })

    items = new Map<string, vscode.StatusBarItem>()
}

// http://qt.gtimg.cn/q=sz000001,sh000001
async function querySymbolsCN(codes): Promise<Array<Object>> {
    let options = {
        hostname: 'qt.gtimg.cn',
        path: `/q=${codes.join(',').toLowerCase()}`,
    };

    const parse = (str: string): Array<Object> => {
        return ('' + str).replace(/[;\s]+$/, '').split(';').map(item => {
            let temp: any = {};
            let iraw = ('' + item).split('="');
            temp['symbol'] = iraw[0].replace(/^[\s\n]*v_/, '').toUpperCase();
            let values = iraw[1].split('~');
            [
                '市场', '名称', '代码', 'latestPrice', '昨收', '今开', '成交量', '外盘', '内盘',
                '买一', '买一量', '买二', '买二量', '买三', '买三量', '买四', '买四量', '买五', '买五量',
                '卖一', '卖一量', '卖二', '卖二量', '卖三', '卖三量', '卖四', '卖四量', '卖五', '卖五量',
                '最近逐笔成交', '时间', 'change', 'changePercent', '最高', '最低', '价格/成交量/成交额', '成交量', '成交额',
                '换手率', '市盈率', '未知', '最高', '最低', '振幅', '流通市值', '总市值', '市净率', '涨停价', '跌停价'
            ].forEach(name => {
                temp[name] = values.shift() || '';
            });
            temp['最近逐笔成交'] = ('' + temp['最近逐笔成交']).split('|');
            return temp;
        });
    };

    return new Promise<Array<Object>>((resolve, reject) => {
        http.request(options, function (resp) {
            let chunks = [];

            resp.on('error', function (error) {
                reject(error);
            });

            resp.on('data', function (chunk) {
                chunks.push(chunk);
            });

            resp.on('end', function () {
                let charset = ((resp.headers['content-type'] || '').match(/charset=(\S+)/) || [])[1] || 'GBK';
                let data = iconv.decode(Buffer.concat(chunks), charset);
                resolve(parse(data));
            });

        }).end();
    });
};


const SYMBOL_CN_REGEXP = /^(sh|sz)\d{6}$/i;
async function fetchSymbols(symbols: string[]) {
    let symbols_cn = [], symbols_others = [];
    symbols.forEach(symbol => {
        if (SYMBOL_CN_REGEXP.test(symbol)) {
            symbols_cn.push(symbol)
        } else {
            symbols_others.push(symbol)
        }
    })
    let responseObj = {};
    if (symbols_others.length > 0) {
        let url = `https://api.iextrading.com/1.0/stock/market/batch?symbols=${symbols_others.join(',')}&types=quote`
        let response = await httpGet(url)
        responseObj = JSON.parse(response)
    }
    if (symbols_cn.length > 0) {
        let respCN = await querySymbolsCN(symbols_cn);
        respCN.forEach(resp => {
            responseObj[resp['symbol']] = { quote: resp }
        });
    }
    return responseObj
}

async function refreshSymbols(symbols: string[]): Promise<void> {
    if (!symbols.length) {
        return;
    }
    try {
        const responseObj = await fetchSymbols(symbols)
        Object.keys(responseObj)
            .forEach(key => updateItemWithSymbolQuote(responseObj[key].quote))
    } catch (e) {
        throw new Error(`Invalid response: ${e.message}`);
    }
}

function updateItemWithSymbolQuote(symbolQuote) {
    const symbol = symbolQuote.symbol.toUpperCase()
    const item = items.get(symbol)
    if (!item) return;
    const price: number = parseInt(symbolQuote.latestPrice, 10)
    const percent: number = parseFloat(symbolQuote.changePercent)

    item.text = `${symbol.toUpperCase()} $${price} - ${percent.toFixed(2)}%`
    const config = vscode.workspace.getConfiguration()
    const useColors = config.get('vscode-stocks.useColors', false)
    const [colorUp, colorDown, colorZero] = config.get('vscode-stocks.colorStyle', ['red', 'green', 'white'])
    if (useColors) {
        const change = parseFloat(symbolQuote.change)
        const color = change > 0 ? colorUp :
            change < 0 ? colorDown :
                colorZero
        item.color = color
    } else {
        item.color = undefined
    }
}

function httpGet(url): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get(url, response => {
            let responseData = '';
            response.on('data', chunk => responseData += chunk);
            response.on('end', () => {
                // Sometimes the 'error' event is not fired. Double check here.
                if (response.statusCode === 200) {
                    resolve(responseData)
                } else {
                    reject('fail: ' + response.statusCode)
                }
            })
        })
    })
}

function arrayEq(arr1: any[], arr2: any[]): boolean {
    if (arr1.length !== arr2.length) return false

    return arr1.every((item, i) => item === arr2[i])
}