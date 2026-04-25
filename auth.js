// ================= SISTEMA DE AUTENTICAÇÃO =================

// LISTA DE EMAILS AUTORIZADOS (ADICIONE AQUI OS EMAILS DOS USUÁRIOS)
const AUTHORIZED_USERS = [
    'leandrodevxx@gmail.com',
    'carregador9@wmoldes.com',
    'bruno.teodoro@wheaton.com.br',
    'bruno@wmoldes.com',
    'supervisor@wmoldes.com',
    'operador@wmoldes.com'
    // Adicione mais emails conforme necessário
];

// Verificar se a variável auth existe (vem do firebase-config.js)
if (typeof auth === 'undefined') {
    console.error("❌ auth não está definida. Verifique se firebase-config.js foi carregado.");
}

// Verificar se usuário está autenticado
function checkAuth() {
    return new Promise((resolve, reject) => {
        if (!auth) {
            console.error("❌ Firebase Auth não está inicializada");
            reject(new Error("Firebase Auth não está inicializada"));
            return;
        }
        
        auth.onAuthStateChanged((user) => {
            if (user) {
                console.log("✅ Usuário autenticado:", user.email);
                resolve(user);
            } else {
                console.log("❌ Nenhum usuário autenticado");
                resolve(null);
            }
        }, (error) => {
            console.error("❌ Erro na verificação de autenticação:", error);
            reject(error);
        });
    });
}

// Função para fazer login
async function login(email, password) {
    try {
        console.log("🔐 Tentando login para:", email);
        
        // Verificar se o email está na lista autorizada ANTES de tentar login
        if (!AUTHORIZED_USERS.includes(email.toLowerCase())) {
            console.error("❌ Email não autorizado:", email);
            return { 
                success: false, 
                error: "Acesso negado. Este email não está autorizado para acessar o sistema." 
            };
        }
        
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log("✅ Login bem-sucedido:", userCredential.user.email);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error("❌ Erro no login:", error);
        
        // Mensagens de erro mais amigáveis
        let errorMessage = error.message;
        if (error.code === 'auth/user-not-found') {
            errorMessage = "Usuário não encontrado. Verifique o email.";
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = "Senha incorreta. Tente novamente.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Email inválido.";
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = "Muitas tentativas. Tente novamente mais tarde.";
        }
        
        return { success: false, error: errorMessage };
    }
}

// Função para fazer logout
async function logout() {
    try {
        console.log("🚪 Fazendo logout...");
        await auth.signOut();
        console.log("✅ Logout bem-sucedido");
        return true;
    } catch (error) {
        console.error("❌ Erro no logout:", error);
        return false;
    }
}

// Função para verificar se é admin/autorizado
function isAuthorized(user) {
    if (!user || !user.email) {
        return false;
    }
    
    // Verificar se o email está na lista de autorizados
    const isAuthorized = AUTHORIZED_USERS.includes(user.email.toLowerCase());
    console.log(`🔐 Verificação de autorização para ${user.email}: ${isAuthorized ? 'AUTORIZADO' : 'NÃO AUTORIZADO'}`);
    return isAuthorized;
}

// Proteger página admin - VERIFICA SE O USUÁRIO ESTÁ NA LISTA AUTORIZADA
async function protectAdminPage() {
    try {
        const user = await checkAuth();
        
        if (!user) {
            console.log("🔒 Usuário não autenticado, redirecionando para login");
            window.location.href = 'login.html';
            return null;
        }
        
        // Verificar se o usuário está na lista de autorizados
        if (!isAuthorized(user)) {
            console.log("⛔ Usuário não autorizado:", user.email);
            
            // Fazer logout do usuário não autorizado
            await auth.signOut();
            
            alert("Acesso negado. Você não está autorizado para acessar esta área.");
            window.location.href = 'index.html';
            return null;
        }
        
        console.log("✅ Usuário autenticado e autorizado:", user.email);
        return user;
        
    } catch (error) {
        console.error("❌ Erro na verificação de autenticação:", error);
        window.location.href = 'login.html';
        return null;
    }
}

// Mostrar/ocultar elementos baseado na autenticação
function updateUIForAuth(user) {
    const adminLink = document.querySelector('[onclick*="admin.html"]');
    if (adminLink) {
        if (user) {
            // Verificar se o usuário é autorizado antes de mostrar o link
            if (isAuthorized(user)) {
                adminLink.innerHTML = '<i class="fas fa-cog"></i> Painel Admin';
                adminLink.style.display = 'flex';
            } else {
                adminLink.style.display = 'none';
            }
        } else {
            adminLink.innerHTML = '<i class="fas fa-lock"></i> Login Admin';
            adminLink.style.display = 'flex';
        }
    }
}

// Função para adicionar novo usuário autorizado (pode ser usada pelo administrador)
function addAuthorizedUser(email) {
    const normalizedEmail = email.toLowerCase().trim();
    
    if (!AUTHORIZED_USERS.includes(normalizedEmail)) {
        AUTHORIZED_USERS.push(normalizedEmail);
        console.log(`✅ Email adicionado à lista de autorizados: ${normalizedEmail}`);
        return true;
    }
    
    console.log(`⚠️ Email já está na lista de autorizados: ${normalizedEmail}`);
    return false;
}

// Função para remover usuário autorizado
function removeAuthorizedUser(email) {
    const normalizedEmail = email.toLowerCase().trim();
    const index = AUTHORIZED_USERS.indexOf(normalizedEmail);
    
    if (index !== -1) {
        AUTHORIZED_USERS.splice(index, 1);
        console.log(`✅ Email removido da lista de autorizados: ${normalizedEmail}`);
        return true;
    }
    
    console.log(`⚠️ Email não encontrado na lista de autorizados: ${normalizedEmail}`);
    return false;
}

// Função para obter lista de usuários autorizados (apenas para admin)
function getAuthorizedUsers() {
    return [...AUTHORIZED_USERS]; // Retorna cópia da lista
}

// Inicializar autenticação quando o DOM carregar
document.addEventListener('DOMContentLoaded', function() {
    console.log("🔐 Lista de usuários autorizados:", AUTHORIZED_USERS);
    
    // Verificar se estamos na página admin
    if (window.location.pathname.includes('admin.html')) {
        console.log("🔐 Página admin detectada, verificando autenticação e autorização...");
        
        // Verificar autenticação e autorização
        checkAuth().then(user => {
            if (!user) {
                console.log("🔒 Usuário não autenticado, redirecionando para login");
                window.location.href = 'login.html';
                return;
            }
            
            // Verificar se está autorizado
            if (!isAuthorized(user)) {
                console.log("⛔ Usuário não autorizado, redirecionando para dashboard");
                
                // Fazer logout do usuário não autorizado
                auth.signOut().then(() => {
                    alert("Acesso negado. Você não está autorizado para acessar o painel administrativo.");
                    window.location.href = 'index.html';
                });
            } else {
                console.log("✅ Usuário autorizado, pode acessar o painel admin");
            }
        }).catch(error => {
            console.error("❌ Erro na verificação de autenticação:", error);
        });
    }
});

// Exportar para uso global
window.checkAuth = checkAuth;
window.login = login;
window.logout = logout;
window.protectAdminPage = protectAdminPage;
window.updateUIForAuth = updateUIForAuth;
window.isAuthorized = isAuthorized;
window.addAuthorizedUser = addAuthorizedUser;
window.removeAuthorizedUser = removeAuthorizedUser;
window.getAuthorizedUsers = getAuthorizedUsers;
window.AUTHORIZED_USERS = AUTHORIZED_USERS; // Exportar para admin.js usar

console.log("✅ Sistema de autenticação carregado com lista de usuários autorizados");