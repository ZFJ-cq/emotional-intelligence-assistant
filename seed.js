// seed.js - 轻量版，数据从seed-bundle.json异步加载
var SEED_DATA = { scenes: [], replies: [] };

async function seedDatabase() {
    const sceneCount = await DB.count('scenes');
    const replyCount = await DB.count('replies');
    const SEED_VERSION = 30;
    const storedVersion = await DB.getSetting('seedVersion');
    if (sceneCount > 0 && storedVersion === SEED_VERSION && replyCount > 100) return false;

    // 从seed-bundle.json加载所有数据（scenes + replies）
    let bundle = null;
    try {
        const resp = await fetch('seed-bundle.json');
        if (resp.ok) {
            bundle = await resp.json();
            SEED_DATA.scenes = bundle.scenes || [];
            SEED_DATA.replies = bundle.replies || [];
        }
    } catch(e) {
        console.warn('seed-bundle.json load failed:', e);
    }

    if (!bundle) {
        console.error('Failed to load seed data');
        return false;
    }

    const storeNames = ['scenes', 'replies'];
    const existingCustomReplies = await DB.getAll('replies').then(items => items.filter(item => item && item.userCustom)).catch(() => []);
    const existingCustomScenes = await DB.getAll('scenes').then(items => items.filter(item => item && item.userCustom)).catch(() => []);

    for (const name of storeNames) {
        await DB.clear(name);
    }

    for (const scene of SEED_DATA.scenes) {
        await DB.put('scenes', scene);
    }
    for (const scene of existingCustomScenes) {
        await DB.put('scenes', scene);
    }
    for (const reply of SEED_DATA.replies) {
        await DB.put('replies', reply);
    }
    for (const reply of existingCustomReplies) {
        await DB.put('replies', reply);
    }

    await DB.put('folders', { id: 'default', name: '默认收藏夹', createdAt: new Date().toISOString() });
    await DataLog.add('seed', 'all', 'initial data seeded - ' + SEED_DATA.replies.length + ' replies, ' + SEED_DATA.scenes.length + ' scenes');
    await DB.setSetting('seedVersion', SEED_VERSION);
    return true;
}
