"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPABASE_CONFIGURED = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANONKEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
exports.SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
let supabase = null;
if (!exports.SUPABASE_CONFIGURED) {
    console.warn('Supabase credentials not set: SUPABASE_URL or SUPABASE_ANON_KEY');
}
else {
    try {
        supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    catch (err) {
        console.error('Failed to create Supabase client', err);
        supabase = null;
    }
}
exports.default = supabase;
