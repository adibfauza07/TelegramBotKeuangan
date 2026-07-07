require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mysql = require('mysql2/promise');

// Inisiasi Bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Command bawaan saat pertama kali chat bot atau ketik /start
// Command bawaan saat pertama kali chat bot atau ketik /start
bot.start((ctx) => {
    let pesan = `Halo, Bro! 🤖\nSaya adalah Bot Asisten Keuangan Pribadimu.\n\n`;
    pesan += `Silakan gunakan tombol menu di bawah ini untuk bernavigasi:`;

    // Mengirim pesan beserta Custom Reply Keyboard dengan Label Baru
   // Mengirim pesan beserta Custom Reply Keyboard
    ctx.reply(pesan, 
        Markup.keyboard([
            ['💰 Pemasukan', '💸 Pengeluaran'],
            ['🗓️ Rekap Harian', '📅 Rekap Bulanan'], // <--- Tambah di sini
            ['📝 Riwayat Transaksi', '📊 Laporan Saldo'],
            ['📈 Grafik Pengeluaran', '❌ Hapus Transaksi']
        ])
        .resize() 
    );
});

// Konfigurasi Koneksi Database MySQL
const dbConfig = {
    host: 'localhost',
    user: 'root', // Sesuaikan dengan user MySQL kamu
    password: '', // Sesuaikan dengan password MySQL kamu
    database: 'db_keuangan_bot'
};

// Command untuk mencatat pengeluaran
// Format ketik di Telegram: /out Makanan 50000 Makan siang
// Command untuk mencatat pengeluaran
bot.command('out', async (ctx) => {
    const message = ctx.message.text;
    const parts = message.split(' ');

    if (parts.length < 4) {
        return ctx.reply('Format salah! Gunakan: /out [Kategori] [Nominal] [Keterangan]\nContoh: /out Makanan 50000 Makan siang');
    }

    const kategori = parts[1];
    const nominal = parseFloat(parts[2]);
    const keterangan = parts.slice(3).join(' '); 
    const waktuSekarang = new Date();
    const tanggalSQL = waktuSekarang.toISOString().split('T')[0]; 
    const userId = ctx.from.id; // Menangkap ID Telegram user

    try {
        const connection = await mysql.createConnection(dbConfig);
        // Simpan hasil eksekusi ke dalam variabel result untuk mengambil ID
        const [result] = await connection.execute(
            'INSERT INTO transaksi (user_id, tanggal, tipe, kategori, nominal, keterangan) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, tanggalSQL, 'Pengeluaran', kategori, nominal, keterangan]
        );
        await connection.end();

        // Mengambil ID yang baru saja digenerate oleh MySQL
        const idTransaksi = result.insertId;
        
        // Format waktu ke format lokal Indonesia (WIB)
        const waktuFormat = waktuSekarang.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

        const formatter = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        });
        const nominalRupiah = formatter.format(nominal);

        // Susunan balasan menggunakan HTML
        let pesan = `✅ <b>Pengeluaran berhasil dicatat!</b>\n\n`;
        pesan += `🆔 <b>ID Transaksi:</b> ${idTransaksi}\n`;
        pesan += `⏰ <b>Waktu Input:</b> ${waktuFormat} WIB\n`;
        pesan += `📁 <b>Kategori:</b> ${kategori}\n`;
        pesan += `💸 <b>Nominal:</b> ${nominalRupiah}\n`;
        pesan += `📝 <b>Keterangan:</b> ${keterangan}`;

        ctx.reply(pesan, { parse_mode: 'HTML' });
    } catch (error) {
        console.error(error);
        ctx.reply('❌ Terjadi kesalahan saat menyimpan data ke database.');
    }
});

// Listener menggunakan Regex (/.../i) agar kebal terhadap perbedaan Unicode Emoji
// Listener untuk tombol Bantuan Input (Sertakan Emojinya agar spesifik!)
bot.hears(/💰 Pemasukan/i, (ctx) => {
    ctx.reply('Gunakan format perintah ini untuk mencatat Pemasukan baru:\n\n👉 /in [Kategori] [Nominal] [Keterangan]\nContoh: /in Gaji 10000000 Gaji Pokok');
});

bot.hears(/💸 Pengeluaran/i, (ctx) => {
    ctx.reply('Gunakan format perintah ini untuk mencatat Pengeluaran baru:\n\n👉 /out [Kategori] [Nominal] [Keterangan]\nContoh: /out Makan 50000 Naspad');
});

// Listener untuk tombol Hapus Transaksi
bot.hears(/❌ Hapus Transaksi/i, (ctx) => {
    let balas = `Untuk menghapus data yang salah, pastikan kamu mengecek ID Transaksinya terlebih dahulu di menu <b>📝 Riwayat Transaksi</b>.\n\n`;
    balas += `Setelah tahu ID-nya, ketik perintah ini:\n`;
    balas += `👉 <b>/delete [ID]</b>\n\n`;
    balas += `Contoh: <code>/delete 3</code>`;
    
    ctx.reply(balas, { parse_mode: 'HTML' });
});



// Command untuk mencatat pemasukan
// Format: /in [Kategori] [Nominal] [Keterangan]
// Command untuk mencatat pemasukan
bot.command('in', async (ctx) => {
    const message = ctx.message.text;
    const parts = message.split(' ');

    if (parts.length < 4) {
        return ctx.reply('Format salah! Gunakan: /in [Kategori] [Nominal] [Keterangan]\nContoh: /in Gaji 10000000 Gaji Bulanan');
    }

    const kategori = parts[1];
    const nominal = parseFloat(parts[2]);
    const keterangan = parts.slice(3).join(' '); 
    const waktuSekarang = new Date();
    const tanggalSQL = waktuSekarang.toISOString().split('T')[0]; 
    const userId = ctx.from.id; // Menangkap ID Telegram user

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [result] = await connection.execute(
            'INSERT INTO transaksi (user_id, tanggal, tipe, kategori, nominal, keterangan) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, tanggalSQL, 'Pemasukan', kategori, nominal, keterangan]
        );
        await connection.end();

        // Mengambil ID yang baru saja digenerate oleh MySQL
        const idTransaksi = result.insertId;
        
        // Format waktu ke format lokal Indonesia (WIB)
        const waktuFormat = waktuSekarang.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

        const formatter = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        });
        const nominalRupiah = formatter.format(nominal);

        // Susunan balasan menggunakan HTML
        let pesan = `✅ <b>Pemasukan berhasil dicatat!</b>\n\n`;
        pesan += `🆔 <b>ID Transaksi:</b> ${idTransaksi}\n`;
        pesan += `⏰ <b>Waktu Input:</b> ${waktuFormat} WIB\n`;
        pesan += `📁 <b>Kategori:</b> ${kategori}\n`;
        pesan += `💰 <b>Nominal:</b> ${nominalRupiah}\n`;
        pesan += `📝 <b>Keterangan:</b> ${keterangan}`;

        ctx.reply(pesan, { parse_mode: 'HTML' });
    } catch (error) {
        console.error(error);
        ctx.reply('❌ Terjadi kesalahan saat menyimpan data Pemasukan ke database.');
    }
});

// Command untuk melihat laporan / saldo
bot.hears(['/report', /📊 Laporan Saldo/i], async (ctx) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const userId = ctx.from.id;
        // Query untuk menghitung total pemasukan
        const [inResult] = await connection.execute(
            "SELECT SUM(nominal) as total_in FROM transaksi WHERE tipe = 'Pemasukan' AND user_id = ?",
            [userId]
        );
        const totalIn = inResult[0].total_in || 0;

        // Query untuk menghitung total pengeluaran
        const [outResult] = await connection.execute(
            "SELECT SUM(nominal) as total_out FROM transaksi WHERE tipe = 'Pengeluaran' AND user_id = ?",
            [userId]
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

// Command untuk rekap harian
bot.hears(['/rekapharian', /🗓️ Rekap Harian/i], async (ctx) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Ambil tanggal hari ini untuk mencocokkan dengan database
        const waktuSekarang = new Date();
        const hariIniSQL = waktuSekarang.toISOString().split('T')[0]; // Format: YYYY-MM-DD
        
        // Format tanggal untuk ditampilkan di Telegram (DD/MM/YYYY)
        const formatTanggal = waktuSekarang.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });

        // Query Pengeluaran Hari Ini
        const [outRows] = await connection.execute(
            `SELECT kategori, SUM(nominal) as total 
             FROM transaksi 
             WHERE tipe = 'Pengeluaran' AND tanggal = ? 
             GROUP BY kategori ORDER BY total DESC`,
            [hariIniSQL]
        );

        // Query Pemasukan Hari Ini
        const [inRows] = await connection.execute(
            `SELECT kategori, SUM(nominal) as total 
             FROM transaksi 
             WHERE tipe = 'Pemasukan' AND tanggal = ? 
             GROUP BY kategori ORDER BY total DESC`,
            [hariIniSQL]
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

        // Menghitung selisih (Saldo Hari Ini)
        let totalPengeluaran = 0;
        outRows.forEach(row => {
            totalPengeluaran += parseFloat(row.total);
        });

        let totalPemasukan = 0;
        inRows.forEach(row => {
            totalPemasukan += parseFloat(row.total);
        });

        let selisihHariIni = totalPemasukan - totalPengeluaran;

        // Menyusun Pesan Balasan menggunakan HTML
        let pesan = `🗓️ <b>Rekap Hari Ini (${formatTanggal})</b>\n\n`;
        
        pesan += `📉 <b>Pengeluaran:</b>\n`;
        if (outRows.length > 0) {
            outRows.forEach(row => {
                pesan += `▫️ ${row.kategori}: ${formatRp(row.total)}\n`;
            });
        } else {
            pesan += `▫️ <i>Belum ada pengeluaran hari ini.</i>\n`;
        }

        pesan += `\n📈 <b>Pemasukan:</b>\n`;
        if (inRows.length > 0) {
            inRows.forEach(row => {
                pesan += `▫️ ${row.kategori}: ${formatRp(row.total)}\n`;
            });
        } else {
            pesan += `▫️ <i>Belum ada pemasukan hari ini.</i>\n`;
        }

        // Menampilkan Selisih Hari Ini
        pesan += `\n═══════════════════\n`;
        pesan += `⚖️ <b>Selisih Hari Ini: ${formatRp(selisihHariIni)}</b>`;

        ctx.reply(pesan, { parse_mode: 'HTML' });

    } catch (error) {
        console.error(error);
        ctx.reply('❌ Terjadi kesalahan saat menarik data rekap harian.');
    }
});

// Command untuk rekap pengeluaran dan pemasukan bulanan per kategori
// Command untuk rekap bulanan (Sudah Support Multi-User)
bot.hears(['/rekap', /📅 Rekap Bulanan/i], async (ctx) => {
    const userId = ctx.from.id; // Tangkap ID User

    try {
        const connection = await mysql.createConnection(dbConfig);
        
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        // Query Pengeluaran
        const [outRows] = await connection.execute(
            `SELECT kategori, SUM(nominal) as total 
             FROM transaksi 
             WHERE tipe = 'Pengeluaran' AND user_id = ? 
             AND MONTH(tanggal) = ? AND YEAR(tanggal) = ? 
             GROUP BY kategori ORDER BY total DESC`,
            [userId, currentMonth, currentYear]
        );

        // Query Pemasukan
        const [inRows] = await connection.execute(
            `SELECT kategori, SUM(nominal) as total 
             FROM transaksi 
             WHERE tipe = 'Pemasukan' AND user_id = ? 
             AND MONTH(tanggal) = ? AND YEAR(tanggal) = ? 
             GROUP BY kategori ORDER BY total DESC`,
            [userId, currentMonth, currentYear]
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

        // Menghitung Sisa Saldo Bulan Ini
        let totalPengeluaran = 0;
        outRows.forEach(row => {
            totalPengeluaran += parseFloat(row.total);
        });

        let totalPemasukan = 0;
        inRows.forEach(row => {
            totalPemasukan += parseFloat(row.total);
        });

        let sisaSaldo = totalPemasukan - totalPengeluaran;

        // Menyusun Pesan Balasan
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

        pesan += `\n═══════════════════\n`;
        pesan += `💰 <b>Sisa Saldo Bulan Ini: ${formatRp(sisaSaldo)}</b>`;

        ctx.reply(pesan, { parse_mode: 'HTML' });

    } catch (error) {
        console.error(error);
        ctx.reply('❌ Terjadi kesalahan saat menarik data rekap bulanan.');
    }
});

// Command untuk melihat 5 transaksi terakhir
bot.hears(['/history', /📝 Riwayat Transaksi/i], async (ctx) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const userId = ctx.from.id;
        // Ambil 5 data terakhir berdasarkan ID terbesar (terbaru)
        const [rows] = await connection.execute(
            'SELECT id, tanggal, tipe, kategori, nominal, keterangan FROM transaksi WHERE user_id = ? ORDER BY id DESC LIMIT 5',
            [userId]
        );
        
        await connection.end();

        // Cek jika database masih kosong
        if (rows.length === 0) {
            return ctx.reply('Belum ada data transaksi yang tercatat, Bro.');
        }

        // Fungsi bantuan untuk format Rupiah
        const formatRp = (angka) => {
            return new Intl.NumberFormat('id-ID', { 
                style: 'currency', 
                currency: 'IDR', 
                minimumFractionDigits: 0 
            }).format(angka);
        };

        // Menyusun Pesan Balasan dengan HTML
        let pesan = `📝 <b>5 Transaksi Terakhir:</b>\n\n`;
        
        rows.forEach(row => {
            const tgl = new Date(row.tanggal).toLocaleDateString('id-ID');
            const icon = row.tipe === 'Pemasukan' ? '🟢' : '🔴';
            
            pesan += `${icon} <b>ID: ${row.id}</b> | ${tgl}\n`;
            pesan += `Kategori: ${row.kategori}\n`;
            pesan += `Nominal: ${formatRp(row.nominal)}\n`;
            pesan += `Ket: ${row.keterangan}\n`;
            pesan += `-------------------------\n`;
        });

        pesan += `\n💡 <i>Ketik /delete [ID] untuk menghapus transaksi yang salah.</i>`;

        ctx.reply(pesan, { parse_mode: 'HTML' });

    } catch (error) {
        console.error(error);
        ctx.reply('❌ Waduh, terjadi kesalahan sistem saat mengambil riwayat transaksi.');
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
            'DELETE FROM transaksi WHERE id = ? AND user_id = ?',
            [idTransaksi, userId]
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
bot.hears(['/chart', /📈 Grafik Pengeluaran/i], async (ctx) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        // Ambil data pengeluaran bulan ini (dikumpulkan per kategori)
        const [rows] = await connection.execute(
            `SELECT kategori, SUM(nominal) as total 
             FROM transaksi 
             WHERE tipe = 'Pengeluaran' AND user_id = ?
             AND MONTH(tanggal) = ? AND YEAR(tanggal) = ? 
             GROUP BY kategori`,
            [userId, currentMonth, currentYear]
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
        const chartUrl = `https://quickchart.io/chart?w=600&h=400&bkg=white&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;

        // 4. Kirim sebagai teks HTML dengan link tersembunyi untuk memancing URL Preview Telegram
        const pesan = `📊 <b>Grafik Pengeluaran Bulan Ini (${currentMonth}/${currentYear})</b>\n<a href="${chartUrl}">&#8205;</a>`;
        
        ctx.reply(pesan, { parse_mode: 'HTML' });
    } catch (error) {
        console.error(error);
        ctx.reply('❌ Terjadi kesalahan saat mencoba merender grafik.');
    }
});

// Mengatur Menu Command (Hamburger Menu)
bot.telegram.setMyCommands([
    { command: 'start', description: 'Lihat daftar perintah bot' },
    { command: 'in', description: 'Catat Pemasukan Baru' },
    { command: 'out', description: 'Catat Pengeluaran Baru' },
    { command: 'report', description: 'Lihat Total Saldo' },
    { command: 'rekap', description: 'Lihat Rekap Kategori Bulan Ini' },
    { command: 'history', description: 'Lihat 5 Transaksi Terakhir' },
    { command: 'chart', description: 'Lihat Grafik Pengeluaran' }
]);

// Command untuk memunculkan tombol interaktif
bot.command('menu', (ctx) => {
    ctx.reply('Pilih aksi cepat di bawah ini, Bro:',
        Markup.inlineKeyboard([
            // Baris pertama (2 tombol)
            [
                Markup.button.callback('🟢 Pemasukan', 'btn_in'),
                Markup.button.callback('🔴 Pengeluaran', 'btn_out')
            ],
            // Baris kedua (2 tombol)
            [
                Markup.button.callback('📊 Rekap Bulanan', 'btn_rekap'),
                Markup.button.callback('📈 Lihat Grafik', 'btn_chart')
            ]
        ])
    );
});

// --- CARA MENANGANI SAAT TOMBOL DITEKAN ---

// Saat tombol "Rekap Bulanan" ditekan
// Command untuk rekap bulanan (Sudah Support Multi-User)
// Command untuk rekap bulanan (Sudah Support Multi-User)
bot.hears(['/rekap', /📅 Rekap Bulanan/i], async (ctx) => {
    // 1. Tangkap ID Telegram unik milik user yang sedang mengeklik tombol
    const userId = ctx.from.id; 

    try {
        const connection = await mysql.createConnection(dbConfig);
        
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        // 2. Query Pengeluaran (Difilter HANYA untuk user_id ini)
        const [outRows] = await connection.execute(
            `SELECT kategori, SUM(nominal) as total 
             FROM transaksi 
             WHERE tipe = 'Pengeluaran' AND user_id = ? 
             AND MONTH(tanggal) = ? AND YEAR(tanggal) = ? 
             GROUP BY kategori ORDER BY total DESC`,
            [userId, currentMonth, currentYear]
        );

        // 3. Query Pemasukan (Difilter HANYA untuk user_id ini) -> Ini yang sebelumnya terlewat!
        const [inRows] = await connection.execute(
            `SELECT kategori, SUM(nominal) as total 
             FROM transaksi 
             WHERE tipe = 'Pemasukan' AND user_id = ? 
             AND MONTH(tanggal) = ? AND YEAR(tanggal) = ? 
             GROUP BY kategori ORDER BY total DESC`,
            [userId, currentMonth, currentYear]
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

        // Menghitung Sisa Saldo Bulan Ini
        let totalPengeluaran = 0;
        outRows.forEach(row => {
            totalPengeluaran += parseFloat(row.total);
        });

        let totalPemasukan = 0;
        inRows.forEach(row => {
            totalPemasukan += parseFloat(row.total);
        });

        let sisaSaldo = totalPemasukan - totalPengeluaran;

        // Menyusun Pesan Balasan menggunakan HTML
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

        // Menampilkan Sisa Saldo
        pesan += `\n═══════════════════\n`;
        pesan += `💰 <b>Sisa Saldo Bulan Ini: ${formatRp(sisaSaldo)}</b>`;

        ctx.reply(pesan, { parse_mode: 'HTML' });

    } catch (error) {
        console.error(error);
        ctx.reply('❌ Terjadi kesalahan saat menarik data rekap bulanan.');
    }
});

// Saat tombol "Lihat Grafik" ditekan
bot.action('btn_chart', async (ctx) => {
    await ctx.answerCbQuery(); 
    const userId = ctx.from.id;
    ctx.reply('Fitur grafik sedang diproses...');
});

// Command untuk cek ID Asli
bot.command('cekid', (ctx) => {
    ctx.reply(`🆔 ID Akun Telegram ini adalah: ${ctx.from.id}`);
});

// Command untuk menghapus SEMUA data milik user tersebut (Reset Total)
bot.command('reset', async (ctx) => {
    const userId = ctx.from.id;

    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Menghapus HANYA data yang memiliki user_id milik pengirim pesan
        const [result] = await connection.execute(
            'DELETE FROM transaksi WHERE user_id = ?',
            [userId]
        );
        
        await connection.end();

        // Mengecek apakah ada data yang berhasil dihapus
        if (result.affectedRows > 0) {
            let pesan = `✅ <b>Reset Berhasil!</b>\n\n`;
            pesan += `Sebanyak <b>${result.affectedRows}</b> data transaksimu telah dihapus secara permanen.\n`;
            pesan += `Mari mulai pencatatan dari awal lagi, Bro! 🚀`;
            
            ctx.reply(pesan, { parse_mode: 'HTML' });
        } else {
            ctx.reply('⚠️ <b>Data Kosong!</b>\nTidak ada data yang bisa dihapus. Brankas keuanganmu memang sudah bersih, Bro.', { parse_mode: 'HTML' });
        }

    } catch (error) {
        console.error(error);
        ctx.reply('❌ Terjadi kesalahan sistem saat mencoba mereset data.');
    }
});

// Menjalankan Bot dengan mode Polling
bot.launch().then(() => {
    console.log('Bot Telegram sedang berjalan di Localhost...');
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));