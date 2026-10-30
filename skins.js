/**
 * skins.js — Главный хаб кастомизации.
 * Связывает:
 *  - model.js (отрисовка тела кота, одежды, анимаций)
 *  - pins.js (стили плиток)
 *  - background.js (биомы каньона)
 *  - trails.js (эффекты следа)
 */

(function () {
    // Автоматически подключаем model.js, если он не был добавлен в HTML
    if (!window.TomModel) {
        const script = document.createElement('script');
        script.src = 'model.js';
        document.head.appendChild(script);
    }

    class CustomizationHub {
        constructor() {
            // Загружаем сохранённый выбор игрока из памяти
            this.selected = {
                skins: localStorage.getItem('tom_skin') || 'classic',
                pins: localStorage.getItem('tom_pin') || 'canyon_paw',
                bg: localStorage.getItem('tom_bg') || 'canyon',
                trails: localStorage.getItem('tom_trail') || 'dust'
            };

            // Каталог скинов (данные передаются в model.js для отрисовки)
            this.skinCatalog = {
                classic: {
                    id: 'classic',
                    name: 'Классик',
                    icon: '🐱',
                    fur: ['#a39f99', '#7f7a75', '#5c5853'],
                    belly: '#e5e5e5',
                    eyes: ['#4ade80', '#16a34a', '#14532d'],
                    hat: null,
                    accessory: null
                },
                cowboy: {
                    id: 'cowboy',
                    name: 'Шериф',
                    icon: '🤠',
                    fur: ['#b59a79', '#8c6e4e', '#5a4128'],
                    belly: '#fde68a',
                    eyes: ['#38bdf8', '#0284c7', '#0c4a6e'],
                    hat: 'cowboy_hat',
                    accessory: 'bandana'
                },
                cyber: {
                    id: 'cyber',
                    name: 'Неон 2077',
                    icon: '🤖',
                    fur: ['#475569', '#1e293b', '#0f172a'],
                    belly: '#38bdf8',
                    eyes: ['#f43f5e', '#e11d48', '#881337'],
                    hat: 'cyber_visor',
                    accessory: null
                },
                gold: {
                    id: 'gold',
                    name: 'Золотой VIP',
                    icon: '👑',
                    fur: ['#fef08a', '#facc15', '#ca8a04'],
                    belly: '#fffbeb',
                    eyes: ['#a855f7', '#7e22ce', '#3b0764'],
                    hat: 'crown',
                    accessory: 'cape'
                }
            };
        }

        /**
         * Получение списка предметов для кнопок в меню index.html
         * @param {string} category — 'skins' | 'pins' | 'bg' | 'trails'
         */
        getItems(category) {
            switch (category) {
                case 'skins':
                    return Object.values(this.skinCatalog).map(item => ({
                        id: item.id,
                        name: item.name,
                        icon: item.icon,
                        active: this.selected.skins === item.id
                    }));

                case 'pins':
                    if (window.Pins && typeof window.Pins.getStylesList === 'function') {
                        return window.Pins.getStylesList(this.selected.pins);
                    }
                    return [
                        { id: 'canyon_paw', name: 'Каньон', icon: '🐾', active: this.selected.pins === 'canyon_paw' },
                        { id: 'gold', name: 'Золото', icon: '⭐', active: this.selected.pins === 'gold' }
                    ];

                case 'bg':
                    if (window.BackgroundEngine && typeof window.BackgroundEngine.getBiomesList === 'function') {
                        return window.BackgroundEngine.getBiomesList(this.selected.bg);
                    }
                    return [
                        { id: 'canyon', name: 'Каньон', icon: '🏜️', active: this.selected.bg === 'canyon' },
                        { id: 'night', name: 'Ночь', icon: '🌌', active: this.selected.bg === 'night' },
                        { id: 'jungle', name: 'Джунгли', icon: '🌴', active: this.selected.bg === 'jungle' }
                    ];

                case 'trails':
                    if (window.TrailEngine && typeof window.TrailEngine.getTrailsList === 'function') {
                        return window.TrailEngine.getTrailsList(this.selected.trails);
                    }
                    return [
                        { id: 'dust', name: 'Пыль', icon: '💨', active: this.selected.trails === 'dust' },
                        { id: 'stars', name: 'Искры', icon: '✨', active: this.selected.trails === 'stars' },
                        { id: 'fire', name: 'Огонь', icon: '🔥', active: this.selected.trails === 'fire' }
                    ];

                default:
                    return [];
            }
        }

        /**
         * Сохранение выбранного элемента игроком
         */
        select(category, id) {
            if (!this.selected[category]) return;
            this.selected[category] = id;

            // Кладём в память, чтобы выбор не сбрасывался при обновлении страницы
            const storageKeys = {
                skins: 'tom_skin',
                pins: 'tom_pin',
                bg: 'tom_bg',
                trails: 'tom_trail'
            };
            if (storageKeys[category]) {
                localStorage.setItem(storageKeys[category], id);
            }
        }

        /**
         * Получить конфиг активного скина
         */
        getActiveSkinConfig() {
            return this.skinCatalog[this.selected.skins] || this.skinCatalog.classic;
        }

        /**
         * Единая точка отрисовки Тома — делегирует задачу в model.js
         */
        renderCharacter(ctx, charObj, isGhost = false, gameTime = 0, drag = null) {
            const skinConfig = this.getActiveSkinConfig();
            if (window.TomModel && typeof window.TomModel.draw === 'function') {
                window.TomModel.draw(ctx, charObj, skinConfig, isGhost, gameTime, drag);
            }
        }
    }

    // Экспорт в глобальную область видимости
    window.CustomManager = new CustomizationHub();
})();
