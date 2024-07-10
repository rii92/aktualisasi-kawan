class MessageWaBot{
    constructor(message) {
        this.message = message;
      }

    messageFirst(data){
        return `Halo, ${data["panggilan"]} ${data["nama"]}!\n\nKami telah menerima formulir pendaftaran Anda sebagai mitra Sobat BPS. Namun, kami perhatikan bahwa terdapat beberapa data yang belum lengkap, termasuk\n\ncatatan: [${data["catatan"]}]\n\nMohon untuk melengkapi data Anda dengan mengunjungi link berikut [https://mitra.bps.go.id/] atau Anda dapat langsung memperbarui informasi melalui aplikasi Sobat BPS.\n\nKami menantikan partisipasi aktif Anda sebagai mitra BPS. Jika ada pertanyaan, jangan ragu untuk menghubungi kami pada no https://wa.me/${data["cp"]}.\n\nTerima kasih`;
    }
}