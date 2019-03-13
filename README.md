# Stocks

Keep an eye on your stocks while using VS Code, with the "Stocks" extension.

## Features

Add as many stock symbols as you like to the status bar, and they will be updated every 60 seconds. Just set `vscode-stocks.stockSymbols` to an array of stock symbols to monitor. Example:
```json
"vscode-stocks.stockSymbols": [
    "msft",
    "aapl"
]
```

<img src="https://raw.githubusercontent.com/roblourens/vscode-stocks/master/images/example.png">

It can show symbols color-coded by gain/loss with the setting `vscode-stocks.useColors`.

<img src="https://raw.githubusercontent.com/roblourens/vscode-stocks/master/images/example_colors.png">

## Disclaimer
By reading this, you agree not to sue me.

## Update By loskael

1、Add `SSE` And `SZSE` Support  
2、Add color style
```json
"vscode-stocks.colorStyle": [
    "red",    // up
    "green",  // down
    "white"   // -
]
```
3、Add change pencent
4、Add refresh interval
```json
"vscode-stocks.refreshInterval": 5000
```