param(
  [int]$Port = 3217
)

Set-Location 'M:\codexworkspace\sokoban-dress-quest'
$env:Path = 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:Path
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'M:\code\nodejs\node_modules\npm\bin\npm-cli.js' run start -- --port $Port
