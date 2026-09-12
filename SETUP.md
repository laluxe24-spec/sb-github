# Macのターミナルで「セカンドブレイン」コマンドを作る

## やりたいこと
ターミナルで `セカンドブレイン` と打つだけで、
`cd "/Users/ryuji/Second Brain"` して `claude --remote-control` まで自動で実行されるようにする。

## 手順

1. `~/.zshrc` に以下を追記する。

```sh
secondbrain() {
  cd "/Users/ryuji/Second Brain" && claude --remote-control
}
alias セカンドブレイン=secondbrain
```

2. 設定を反映する。

```sh
source ~/.zshrc
```

3. `セカンドブレイン` と打って動作確認する。

## つまずいたポイント

`~/.zshrc` に直接書き込もうとして `zsh: permission denied: /Users/ryuji/.zshrc` が発生。
`ls -la ~/.zshrc` で所有者・パーミッションを確認してから対処する。

## 設定できたあと、今後やること

ターミナルを開いて

```
セカンドブレイン
```

と打つだけ。
