const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL et SUPABASE_KEY sont requis dans .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Récupère les inscriptions en attente de confirmation
 */
async function getPendingRegistrations() {
    const tableName = process.env.TABLE_NAME || 'inscriptions';
    const statusColumn = process.env.COLUMN_STATUS || 'feedback';
    const statusPending = process.env.STATUS_PENDING || 'pending';

    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq(statusColumn, statusPending);

    if (error) {
        console.error('❌ Erreur Supabase:', error.message);
        return [];
    }

    console.log(`📋 ${data.length} inscription(s) en attente`);
    return data;
}

/**
 * Met à jour le statut d'une inscription
 */
async function updateRegistrationStatus(id, newStatus) {
    const tableName = process.env.TABLE_NAME || 'inscriptions';
    const statusColumn = process.env.COLUMN_STATUS || 'feedback';

    const { error } = await supabase
        .from(tableName)
        .update({ [statusColumn]: newStatus })
        .eq('id', id);

    if (error) {
        console.error(`❌ Erreur mise à jour ID ${id}:`, error.message);
        return false;
    }

    console.log(`✅ Statut mis à jour pour ID ${id}: ${newStatus}`);
    return true;
}

/**
 * Écoute les nouvelles inscriptions en temps réel
 */
function subscribeToNewRegistrations(callback) {
    const tableName = process.env.TABLE_NAME || 'inscriptions';

    const channel = supabase
        .channel('new-registrations')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: tableName
            },
            (payload) => {
                console.log('🆕 Nouvelle inscription détectée!');
                callback(payload.new);
            }
        )
        .subscribe();

    console.log(`👂 Écoute des nouvelles inscriptions sur "${tableName}"...`);
    return channel;
}

module.exports = {
    supabase,
    getPendingRegistrations,
    updateRegistrationStatus,
    subscribeToNewRegistrations
};
