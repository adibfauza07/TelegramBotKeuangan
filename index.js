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

// Command untuk rekap pengeluaran dan pemasukan bulanan per kategori
bot.command('rekap', async (ctx) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Ambil bulan dan tahun saat ini
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        // Query Pengeluaran per Kategori (Bulan Ini)
        const [outRows] = await connection.execute(
            `SELECT kategori, SUM(nominal) as total 
             FROM transaksi 
             WHERE tipe = 'Pengeluaran' 
             AND MONTH(tanggal) = ? AND YEAR(tanggal) = ? 
             GROUP BY kategori ORDER BY total DESC`,
            [currentMonth, currentYear]
        );

        // Query Pemasukan per Kategori (Bulan Ini)
        const [inRows] = await connection.execute(
            `SELECT kategori, SUM(nominal) as total 
             FROM transaksi 
             WHERE tipe = 'Pemasukan' 
             AND MONTH(tanggal) = ? AND YEAR(tanggal) = ? 
             GROUP BY kategori ORDER BY total DESC`,
            [currentMonth, currentYear]
        );
        
        await connection.end();

        // Fungsi bantuan untuk format Rupiah
        const formatRp = (angka) => {
            return new Intl.NumberFormat('id-ID', { 
                style: 'currency', 
                currency: 'IDR', 
                minimumFractionDigits: 0 
            }).format(angka);
        };

        // --- MENGHITUNG SISA SALDO BULAN INI ---
        let totalPengeluaran = 0;
        outRows.forEach(row => {
            totalPengeluaran += parseFloat(row.total);
        });

        let totalPemasukan = 0;
        inRows.forEach(row => {
            totalPemasukan += parseFloat(row.total);
        });

        let sisaSaldo = totalPemasukan - totalPengeluaran;
        // ---------------------------------------

        // Menyusun Pesan Balasan (menggunakan HTML)
        let pesan = `📅 <b>Rekap Kategori Bulan Ini (${currentMonth}/${currentYear})</b>\n\n`;
        
        pesan += `📉 <b>Rincian Pengeluaran:</b>\n`;
        if (outRows.length > 0) {
            outRows.forEach(row => {
                pesan += `▫️ ${row.kategori}: ${formatRp(row.total)}\n`;
            });
        } else {
            pesan += `▫️ Belum ada pengeluaran.\n`;
        }

        pesan += `\n📈 <b>Rincian Pemasukan:</b>\n`;
        if (inRows.length > 0) {
            inRows.forEach(row => {
                pesan += `▫️ ${row.kategori}: ${formatRp(row.total)}\n`;
            });
        } else {
            pesan += `▫️ Belum ada pemasukan.\n`;
        }

        // --- MENAMPILKAN SISA SALDO ---
        pesan += `\n═══════════════════\n`;
        pesan += `💰 <b>Sisa Saldo Bulan Ini: ${formatRp(sisaSaldo)}</b>`;

        ctx.reply(pesan, { parse_mode: 'HTML' });

    } catch (error) {
        console.error(error);
        ctx.reply('❌ Terjadi kesalahan saat menarik data rekap bulanan.');
    }
});

// Command untuk menghapus transaksi berdasarkan ID
// Format: /delete [ID_Transaksi]
bot.command('delete', async (ctx) => {
    const message = ctx.message.text;
    const parts = message.split(' ');

    // Validasi input
    if (parts.length < 2) {
        return ctx.reply('Format salah, Bro! Gunakan: /delete [ID_Transaksi]\nContoh: /delete 3');
    }

    const idTransaksi = parseInt(parts[1]);

    // Pastikan yang diinput adalah angka
    if (isNaN(idTransaksi)) {
        return ctx.reply('ID Transaksi harus berupa angka, Bro!');
    }

    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Eksekusi query DELETE
        const [result] = await connection.execute(
            'DELETE FROM transaksi WHERE id = ?',
            [idTransaksi]
        );
        
        await connection.end();

        // Cek apakah ada baris yang terhapus
        if (result.affectedRows > 0) {
            ctx.reply(`✅ Siap! Transaksi dengan ID ${idTransaksi} berhasil dihapus dari database.`);
        } else {
            ctx.reply(`⚠️ Hmm, transaksi dengan ID ${idTransaksi} tidak ditemukan. Coba cek lagi ID-nya ya.`);
        }

    } catch (error) {
        console.error(error);
        ctx.reply('❌ Waduh, terjadi kesalahan sistem saat mencoba menghapus data.');
    }
});

// Command untuk menampilkan grafik Pie Chart pengeluaran bulanan
bot.command('chart', async (ctx) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        // Ambil data pengeluaran bulan ini (dikumpulkan per kategori)
        const [rows] = await connection.execute(
            `SELECT kategori, SUM(nominal) as total 
             FROM transaksi 
             WHERE tipe = 'Pengeluaran' 
             AND MONTH(tanggal) = ? AND YEAR(tanggal) = ? 
             GROUP BY kategori`,
            [currentMonth, currentYear]
        );
        
        await connection.end();

        // Validasi jika data kosong
        if (rows.length === 0) {
            return ctx.reply('Belum ada data pengeluaran bulan ini untuk dibuatkan grafik, Bro.');
        }

        // 1. Siapkan Array untuk Label (Kategori) dan Data (Nominal)
        const labels = [];
        const dataNominal = [];

        rows.forEach(row => {
            labels.push(row.kategori);
            dataNominal.push(parseFloat(row.total));
        });

        // 2. Susun Konfigurasi Chart.js
        const chartConfig = {
            type: 'outlabeledPie', // Tipe pie chart dengan label di luar agar rapi
            data: {
                labels: labels,
                datasets: [{
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#EA3546', '#662E9B'
                    ],
                    data: dataNominal
                }]
            },
            options: {
                plugins: {
                    legend: false, // Sembunyikan legenda standar
                    outlabels: {
                        text: '%l\nRp%v', // Menampilkan Kategori (%l) dan Nilai (%v)
                        color: 'white',
                        stretch: 35,
                        font: { resizable: true, minSize: 12, maxSize: 16 }
                    }
                }
            }
        };

        // 3. Encode ke URL QuickChart
        // Tambahkan parameter background putih (&bkg=white) agar tidak transparan di dark mode Telegram
        const chartUrl = `https://quickchart.io/chart?w=600&h=400&bkg=white&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;

        // 4. Kirim Gambar menggunakan ctx.replyWithPhoto
        // Telegraf cukup pintar untuk langsung membaca URL gambar
        ctx.replyWithPhoto(
            { url: chartUrl }, 
            { 
                caption: `📊 <b>Grafik Pengeluaran Bulan Ini (${currentMonth}/${currentYear})</b>`, 
                parse_mode: 'HTML' 
            }
        );

    } catch (error) {
        console.error(error);
        ctx.reply('❌ Terjadi kesalahan saat mencoba merender grafik.');
    }
});

// Menjalankan Bot dengan mode Polling
bot.launch().then(() => {
    console.log('Bot Telegram sedang berjalan di Localhost...');
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));