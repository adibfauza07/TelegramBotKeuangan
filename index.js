require('dotenv').config();
const { Telegraf } = require('telegraf');
const mysql = require('mysql2/promise');

// Inisiasi Bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Konfigurasi Koneksi Database MySQL
const dbConfig = {
    host: 'localhost',
    user: 'root', // Sesuaikan dengan user MySQL kamu
    password: '', // Sesuaikan dengan password MySQL kamu
    database: 'db_keuangan_bot'
};

// Command untuk mencatat pengeluaran
// Format ketik di Telegram: /out Makanan 50000 Makan siang
bot.command('out', async (ctx) => {
    // Parsing pesan text
    const message = ctx.message.text;
    const parts = message.split(' ');

    if (parts.length < 4) {
        return ctx.reply('Format salah! Gunakan: /out [Kategori] [Nominal] [Keterangan]\nContoh: /out Makanan 50000 Makan siang');
    }

    const kategori = parts[1];
    const nominal = parseFloat(parts[2]);
    const keterangan = parts.slice(3).join(' '); // Menggabungkan sisa kata menjadi keterangan
    const tanggal = new Date().toISOString().split('T')[0]; // Mendapatkan YYYY-MM-DD hari ini

    try {
        // Membuka koneksi ke database
        const connection = await mysql.createConnection(dbConfig);
        
        // Query Insert Data
        const [result] = await connection.execute(
            'INSERT INTO transaksi (tanggal, tipe, kategori, nominal, keterangan) VALUES (?, ?, ?, ?, ?)',
            [tanggal, 'Pengeluaran', kategori, nominal, keterangan]
        );
        
        await connection.end();

        // Balasan sukses
        ctx.reply(`✅ Pengeluaran berhasil dicatat!\n\nKategori: ${kategori}\nNominal: Rp${nominal}\nKeterangan: ${keterangan}`);
    } catch (error) {
        console.error(error);
        ctx.reply('❌ Terjadi kesalahan saat menyimpan ke database.');
    }
});

// Command untuk mencatat pemasukan
// Format: /in [Kategori] [Nominal] [Keterangan]
bot.command('in', async (ctx) => {
    const message = ctx.message.text;
    const parts = message.split(' ');

    // Validasi jumlah parameter
    if (parts.length < 4) {
        return ctx.reply('Format salah! Gunakan: /in [Kategori] [Nominal] [Keterangan]\nContoh: /in Gaji 10000000 Gaji Bulanan');
    }

    const kategori = parts[1];
    const nominal = parseFloat(parts[2]);
    const keterangan = parts.slice(3).join(' '); 
    const tanggal = new Date().toISOString().split('T')[0]; 

    try {
        // Eksekusi query ke database
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute(
            'INSERT INTO transaksi (tanggal, tipe, kategori, nominal, keterangan) VALUES (?, ?, ?, ?, ?)',
            [tanggal, 'Pemasukan', kategori, nominal, keterangan]
        );
        await connection.end();

        // Format nominal ke bentuk Rupiah (contoh: Rp10.000.000)
        const formatter = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        });
        const nominalRupiah = formatter.format(nominal);

        // Balasan sukses
        ctx.reply(`✅ Pemasukan berhasil dicatat!\n\nKategori: ${kategori}\nNominal: ${nominalRupiah}\nKeterangan: ${keterangan}`);
    } catch (error) {
        console.error(error);
        ctx.reply('❌ Terjadi kesalahan saat menyimpan data Pemasukan ke database.');
    }
});

// Command untuk melihat laporan / saldo
bot.command('report', async (ctx) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Query untuk menghitung total pemasukan
        const [inResult] = await connection.execute(
            "SELECT SUM(nominal) as total_in FROM transaksi WHERE tipe = 'Pemasukan'"
        );
        const totalIn = inResult[0].total_in || 0;

        // Query untuk menghitung total pengeluaran
        const [outResult] = await connection.execute(
            "SELECT SUM(nominal) as total_out FROM transaksi WHERE tipe = 'Pengeluaran'"
        );
        const totalOut = outResult[0].total_out || 0;

        await connection.end();

        // Hitung Saldo
        const saldo = totalIn - totalOut;

        // Format ke Rupiah
        const formatter = new Intl.NumberFormat('id-ID', { 
            style: 'currency', 
            currency: 'IDR', 
            minimumFractionDigits: 0 
        });

        // Balasan dengan format Markdown (tebal)
        const pesanLaporan = `📊 *Laporan Keuangan Saat Ini*\n\n` +
                             `📈 Pemasukan: ${formatter.format(totalIn)}\n` +
                             `📉 Pengeluaran: ${formatter.format(totalOut)}\n\n` +
                             `💰 *Saldo Akhir: ${formatter.format(saldo)}*`;

        ctx.reply(pesanLaporan, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error(error);
        ctx.reply('❌ Terjadi kesalahan saat mengambil data laporan.');
    }
});

// Menjalankan Bot dengan mode Polling
bot.launch().then(() => {
    console.log('Bot Telegram sedang berjalan di Localhost...');
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));