# Публикация на GitHub Pages

Репозиторий: maxpol-ph/portfolio (публичный), ветка main, папка корня.

## Один раз (нужна авторизация Макса)
1. Установить gh: `curl -sL https://raw.githubusercontent.com/cli/cli/trunk/deploy/install.sh | sh` (или скачать с github.com/cli/cli/releases)
2. `gh auth login` - выбрать GitHub.com, HTTPS, Login with a web browser, вставить код.
3. Проверить: `gh auth status`

## Публикация (после авторизации)
```
cd ~/Documents/Portfolio/landing
./deploy.sh
```
Скрипт создаёт репозиторий, пушит main и включает Pages.
Сайт: https://maxpol-ph.github.io/portfolio/
