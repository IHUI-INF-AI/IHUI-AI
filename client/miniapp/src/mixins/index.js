export const pageMixin = {
    data() {
        return {
            loading: false,
            refreshing: false,
            finished: false,
            page: 1,
            pageSize: 10,
            total: 0,
            list: []
        }
    },
    methods: {
        async loadData() {
            if (this.loading || this.finished) return
            this.loading = true
            try {
                const res = await this.fetchData()
                this.list = [...this.list, ...res.list]
                this.total = res.total
                this.page++
                if (this.list.length >= this.total) {
                    this.finished = true
                }
            } catch (error) {
            } finally {
                this.loading = false
            }
        },
        
        async refresh() {
            this.refreshing = true
            this.page = 1
            this.finished = false
            this.list = []
            await this.loadData()
            this.refreshing = false
        },
        
        reset() {
            this.page = 1
            this.finished = false
            this.list = []
        }
    }
}

export const formMixin = {
    data() {
        return {
            form: {},
            rules: {},
            errors: {}
        }
    },
    methods: {
        validate() {
            this.errors = {}
            let valid = true
            
            for (const field in this.rules) {
                const value = this.form[field]
                const rules = this.rules[field]
                
                for (const rule of rules) {
                    if (rule.required && !value) {
                        this.errors[field] = rule.message
                        valid = false
                        break
                    }
                    
                    if (rule.pattern && !rule.pattern.test(value)) {
                        this.errors[field] = rule.message
                        valid = false
                        break
                    }
                }
            }
            
            return valid
        },
        
        resetForm() {
            this.form = {}
            this.errors = {}
        }
    }
}

export const userMixin = {
    data() {
        return {
            _userInfoData: null,
            isLogin: false
        }
    },
    methods: {
        async getUserInfo() {
            try {
                const res = await uni.getStorageSync('userInfo')
                if (res) {
                    this._userInfoData = res
                    this.isLogin = true
                }
            } catch (error) {
            }
        },
        
        async updateUserInfo(info) {
            try {
                await uni.setStorageSync('userInfo', info)
                this._userInfoData = info
            } catch (error) {
            }
        },
        
        async logout() {
            try {
                await uni.removeStorageSync('userInfo')
                this._userInfoData = null
                this.isLogin = false
            } catch (error) {
            }
        }
    }
} 