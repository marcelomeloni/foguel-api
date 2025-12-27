import { supabase } from '../services/supabaseService.js';
import jwt from 'jsonwebtoken';
import CryptoJS from 'crypto-js';

// Carregar variáveis de ambiente
const encryptKey = process.env.encrypt_key;
const jwtSecret = process.env.JWT_SECRET;
const adminUsername = process.env.admin_username;
const adminPassword = process.env.admin_password;

// Função para descriptografar o código de acesso
const decryptAccessCode = (encryptedCode) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedCode, encryptKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Erro ao descriptografar:', error);
    return null;
  }
};

// ➤ Login do administrador
export const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validar credenciais
    if (!username || !password) {
      return res.status(400).json({
        error: 'Usuário e senha são obrigatórios'
      });
    }

    // Verificar se as credenciais correspondem ao .env
    if (username !== adminUsername || password !== adminPassword) {
      return res.status(401).json({
        error: 'Credenciais inválidas'
      });
    }

    // Gerar token JWT para admin
    const token = jwt.sign(
      {
        username: username,
        role: 'admin',
        isAdmin: true
      },
      jwtSecret,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      message: 'Login realizado com sucesso',
      token: token,
      user: {
        username: username,
        role: 'admin',
        isAdmin: true
      }
    });

  } catch (error) {
    console.error('Erro no login admin:', error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Login do colaborador
export const colaboradorLogin = async (req, res) => {
  try {
    const { colaborador_id, access_code } = req.body;

    // Validar entrada
    if (!colaborador_id || !access_code) {
      return res.status(400).json({
        error: 'ID do colaborador e código de acesso são obrigatórios'
      });
    }

    // Buscar colaborador no banco de dados
    const { data: colaborador, error: supabaseError } = await supabase
      .from('colaboradores')
      .select('*')
      .eq('id', colaborador_id)
      .single();

    if (supabaseError || !colaborador) {
      return res.status(404).json({
        error: 'Colaborador não encontrado'
      });
    }

    // Descriptografar código de acesso armazenado
    const decryptedStoredCode = decryptAccessCode(colaborador.encrypted_access_code);

    if (!decryptedStoredCode) {
      return res.status(500).json({
        error: 'Erro ao processar código de acesso'
      });
    }

    // Comparar códigos de acesso
    if (access_code !== decryptedStoredCode) {
      return res.status(401).json({
        error: 'Código de acesso inválido'
      });
    }

    // Gerar token JWT para colaborador
    const token = jwt.sign(
      {
        id: colaborador.id,
        nome: colaborador.nome,
        cpf: colaborador.cpf,
        role: 'colaborador',
        isAdmin: false
      },
      jwtSecret,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      message: 'Login realizado com sucesso',
      token: token,
      user: {
        id: colaborador.id,
        nome: colaborador.nome,
        cpf: colaborador.cpf,
        role: 'colaborador',
        isAdmin: false
      }
    });

  } catch (error) {
    console.error('Erro no login colaborador:', error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Listar todos os colaboradores
export const listColaboradores = async (req, res) => {
  try {
    // Buscar todos os colaboradores
    const { data: colaboradores, error } = await supabase
      .from('colaboradores')
      .select('id, nome, cpf')
      .order('nome', { ascending: true });

    if (error) {
      console.error('Erro ao buscar colaboradores:', error);
      return res.status(500).json({
        error: 'Erro ao buscar colaboradores'
      });
    }

    return res.status(200).json(colaboradores || []);

  } catch (error) {
    console.error('Erro ao listar colaboradores:', error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};