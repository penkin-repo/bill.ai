export namespace models {
	
	export class Client {
	    id: string;
	    name: string;
	    inn: string;
	    kpp: string;
	    address: string;
	    bank_name: string;
	    bank_bik: string;
	    bank_account: string;
	    bank_corr_account: string;
	    contact_person: string;
	    phone: string;
	    email: string;
	    comment: string;
	    created_at: string;
	    updated_at: string;
	
	    static createFrom(source: any = {}) {
	        return new Client(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.inn = source["inn"];
	        this.kpp = source["kpp"];
	        this.address = source["address"];
	        this.bank_name = source["bank_name"];
	        this.bank_bik = source["bank_bik"];
	        this.bank_account = source["bank_account"];
	        this.bank_corr_account = source["bank_corr_account"];
	        this.contact_person = source["contact_person"];
	        this.phone = source["phone"];
	        this.email = source["email"];
	        this.comment = source["comment"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class Invoice {
	    id: string;
	    invoice_number: string;
	    invoice_date: string;
	    my_company_id: string;
	    client_id: string;
	    vat_mode: string;
	    vat_rate: number;
	    items_json: string;
	    subtotal: number;
	    vat_amount: number;
	    total: number;
	    total_words: string;
	    comment: string;
	    created_at: string;
	    updated_at: string;
	
	    static createFrom(source: any = {}) {
	        return new Invoice(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.invoice_number = source["invoice_number"];
	        this.invoice_date = source["invoice_date"];
	        this.my_company_id = source["my_company_id"];
	        this.client_id = source["client_id"];
	        this.vat_mode = source["vat_mode"];
	        this.vat_rate = source["vat_rate"];
	        this.items_json = source["items_json"];
	        this.subtotal = source["subtotal"];
	        this.vat_amount = source["vat_amount"];
	        this.total = source["total"];
	        this.total_words = source["total_words"];
	        this.comment = source["comment"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class InvoiceTemplate {
	    id: string;
	    name: string;
	    file_path: string;
	    vat_mode: string;
	    is_default: boolean;
	    is_active: boolean;
	
	    static createFrom(source: any = {}) {
	        return new InvoiceTemplate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.file_path = source["file_path"];
	        this.vat_mode = source["vat_mode"];
	        this.is_default = source["is_default"];
	        this.is_active = source["is_active"];
	    }
	}
	export class MyCompany {
	    id: string;
	    name: string;
	    short_name: string;
	    inn: string;
	    kpp: string;
	    ogrn: string;
	    address: string;
	    bank_name: string;
	    bank_bik: string;
	    bank_account: string;
	    bank_corr_account: string;
	    director_name: string;
	    director_title: string;
	    phone: string;
	    email: string;
	    comment: string;
	
	    static createFrom(source: any = {}) {
	        return new MyCompany(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.short_name = source["short_name"];
	        this.inn = source["inn"];
	        this.kpp = source["kpp"];
	        this.ogrn = source["ogrn"];
	        this.address = source["address"];
	        this.bank_name = source["bank_name"];
	        this.bank_bik = source["bank_bik"];
	        this.bank_account = source["bank_account"];
	        this.bank_corr_account = source["bank_corr_account"];
	        this.director_name = source["director_name"];
	        this.director_title = source["director_title"];
	        this.phone = source["phone"];
	        this.email = source["email"];
	        this.comment = source["comment"];
	    }
	}
	export class Product {
	    id: string;
	    name: string;
	    category: string;
	    unit: string;
	    price: number;
	    description: string;
	    created_at: string;
	    updated_at: string;
	
	    static createFrom(source: any = {}) {
	        return new Product(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.category = source["category"];
	        this.unit = source["unit"];
	        this.price = source["price"];
	        this.description = source["description"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class SyncResult {
	    entity: string;
	    downloaded: number;
	    uploaded: number;
	    errors: number;
	    error_message?: string;
	    synced_at: string;
	
	    static createFrom(source: any = {}) {
	        return new SyncResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.entity = source["entity"];
	        this.downloaded = source["downloaded"];
	        this.uploaded = source["uploaded"];
	        this.errors = source["errors"];
	        this.error_message = source["error_message"];
	        this.synced_at = source["synced_at"];
	    }
	}

}

