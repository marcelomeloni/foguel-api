import { supabase } from '../services/supabaseService.js';
import CryptoJS from 'crypto-js';

// Carregar variável de ambiente
const encryptKey = process.env.encrypt_key;

// Função para criptografar o código de acesso
const encryptAccessCode = (accessCode) => {
  try {
    return CryptoJS.AES.encrypt(accessCode, encryptKey).toString();
  } catch (error) {
    console.error('Erro ao criptografar:', error);
    return null;
  }
};
const decryptAccessCode = (ciphertext) => {
  try {
    if (!ciphertext) return '';
    const bytes = CryptoJS.AES.decrypt(ciphertext, encryptKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Erro ao descriptografar:', error);
    return '';
  }
};
// ============== COLABORADORES ==============

// ➤ Criar Colaborador
export const createColaborador = async (req, res) => {
  try {
    const { nome, cpf, access_code } = req.body;

    // Validar campos obrigatórios
    if (!nome || !cpf || !access_code) {
      return res.status(400).json({ error: 'Nome, CPF e código de acesso são obrigatórios' });
    }

    // Criptografar código de acesso
    const encryptedAccessCode = encryptAccessCode(access_code);
    if (!encryptedAccessCode) {
      return res.status(500).json({ error: 'Erro ao processar código de acesso' });
    }

    // Verificar se CPF já existe
    const { data: existing, error: checkError } = await supabase
      .from('colaboradores')
      .select('id')
      .eq('cpf', cpf)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'CPF já cadastrado' });
    }

    // Inserir no banco
    const { data, error } = await supabase
      .from('colaboradores')
      .insert([{ nome, cpf, encrypted_access_code: encryptedAccessCode }])
      .select();

    if (error) {
      console.error('Erro ao criar colaborador:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json(data[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Editar Colaborador
export const updateColaborador = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, cpf, access_code } = req.body;

    // Construir objeto de atualização
    const updates = {};
    if (nome) updates.nome = nome;
    if (cpf) updates.cpf = cpf;
    
    // Se forneceu novo código de acesso, criptografar
    if (access_code) {
      const encryptedAccessCode = encryptAccessCode(access_code);
      if (!encryptedAccessCode) {
        return res.status(500).json({ error: 'Erro ao processar código de acesso' });
      }
      updates.encrypted_access_code = encryptedAccessCode;
    }

    // Verificar se CPF já existe (se estiver alterando)
    if (cpf) {
      const { data: existing, error: checkError } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('cpf', cpf)
        .neq('id', id)
        .single();

      if (existing) {
        return res.status(409).json({ error: 'CPF já cadastrado para outro colaborador' });
      }
    }

    // Atualizar no banco
    const { data, error } = await supabase
      .from('colaboradores')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) return res.status(400).json({ error });
    if (!data.length) return res.status(404).json({ error: 'Colaborador não encontrado' });

    return res.json(data[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Deletar Colaborador
export const deleteColaborador = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('colaboradores')
      .delete()
      .eq('id', id);

    if (error) return res.status(400).json({ error });

    return res.json({ message: 'Colaborador apagado com sucesso!' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ============== PRODUTOS ==============

// ➤ Criar Produto
export const createProduto = async (req, res) => {
  try {
    const { nome, preco } = req.body;

    if (!nome || preco === undefined) {
      return res.status(400).json({ error: 'Nome e preço são obrigatórios' });
    }

    // Converter preço para número
    const precoNumber = parseFloat(preco);
    if (isNaN(precoNumber) || precoNumber < 0) {
      return res.status(400).json({ error: 'Preço inválido' });
    }

    const { data, error } = await supabase
      .from('produtos')
      .insert([{ nome, preco: precoNumber }])
      .select();

    if (error) return res.status(400).json({ error });
    return res.status(201).json(data[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Editar Produto
export const updateProduto = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validar preço se fornecido
    if (updates.preco !== undefined) {
      const precoNumber = parseFloat(updates.preco);
      if (isNaN(precoNumber) || precoNumber < 0) {
        return res.status(400).json({ error: 'Preço inválido' });
      }
      updates.preco = precoNumber;
    }

    const { data, error } = await supabase
      .from('produtos')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) return res.status(400).json({ error });
    if (!data.length) return res.status(404).json({ error: 'Produto não encontrado' });

    return res.json(data[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Deletar Produto
export const deleteProduto = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('produtos')
      .delete()
      .eq('id', id);

    if (error) return res.status(400).json({ error });

    return res.json({ message: 'Produto apagado com sucesso!' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ============== CLIENTES ==============

// ➤ Criar Cliente
export const createCliente = async (req, res) => {
  try {
    const { 
      nome, 
      cnpj, 
      rua, 
      numero, 
      bairro, 
      cidade, 
      cep 
    } = req.body;

    if (!nome || !cnpj) {
      return res.status(400).json({ error: 'Nome e CNPJ são obrigatórios' });
    }

    // Verificar se CNPJ já existe
    const { data: existing, error: checkError } = await supabase
      .from('clientes')
      .select('id')
      .eq('cnpj', cnpj)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'CNPJ já cadastrado' });
    }

    const { data, error } = await supabase
      .from('clientes')
      .insert([{
        nome,
        cnpj,
        rua: rua || null,
        numero: numero || null,
        bairro: bairro || null,
        cidade: cidade || null,
        cep: cep || null
      }])
      .select();

    if (error) return res.status(400).json({ error });
    return res.status(201).json(data[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Editar Cliente
export const updateCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Verificar se CNPJ já existe (se estiver alterando)
    if (updates.cnpj) {
      const { data: existing, error: checkError } = await supabase
        .from('clientes')
        .select('id')
        .eq('cnpj', updates.cnpj)
        .neq('id', id)
        .single();

      if (existing) {
        return res.status(409).json({ error: 'CNPJ já cadastrado para outro cliente' });
      }
    }

    const { data, error } = await supabase
      .from('clientes')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) return res.status(400).json({ error });
    if (!data.length) return res.status(404).json({ error: 'Cliente não encontrado' });

    return res.json(data[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Deletar Cliente
export const deleteCliente = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id);

    if (error) return res.status(400).json({ error });

    return res.json({ message: 'Cliente apagado com sucesso!' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ============== LISTAGENS ==============

// ➤ Listar Todos os Colaboradores (com paginação opcional)
export const listColaboradores = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('colaboradores')
      .select('*', { count: 'exact' })
      .order('nome', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) return res.status(400).json({ error });
    
    // --- LÓGICA DE DESCRIPTOGRAFIA AQUI ---
    const dataDecrypted = data.map(colab => ({
      ...colab,
      // Cria o campo 'access_code' real a partir do criptografado
      access_code: colab.encrypted_access_code ? decryptAccessCode(colab.encrypted_access_code) : ''
    }));

    return res.json({
      data: dataDecrypted, // Envia os dados descriptografados
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Listar Todos os Produtos
export const listProdutos = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('produtos')
      .select('*', { count: 'exact' })
      .order('nome', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) return res.status(400).json({ error });
    
    return res.json({
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Listar Todos os Clientes
export const listClientes = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('clientes')
      .select('*', { count: 'exact' })
      .order('nome', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) return res.status(400).json({ error });
    
    return res.json({
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};

// ➤ Listar Tudo (Colaboradores, Produtos e Clientes) em um único JSON
export const listAll = async (req, res) => {
  try {
    // Executar todas as consultas em paralelo
    const [
      { data: colaboradores, error: errorColab },
      { data: produtos, error: errorProd },
      { data: clientes, error: errorCli }
    ] = await Promise.all([
      supabase
        .from('colaboradores')
        .select('id, nome, cpf')
        .order('nome', { ascending: true }),
      supabase
        .from('produtos')
        .select('*')
        .order('nome', { ascending: true }),
      supabase
        .from('clientes')
        .select('*')
        .order('nome', { ascending: true })
    ]);

    // Verificar erros
    if (errorColab || errorProd || errorCli) {
      return res.status(400).json({ 
        error: 'Erro ao buscar dados',
        details: { errorColab, errorProd, errorCli }
      });
    }

    return res.json({
      colaboradores: colaboradores || [],
      produtos: produtos || [],
      clientes: clientes || [],
      counts: {
        colaboradores: colaboradores?.length || 0,
        produtos: produtos?.length || 0,
        clientes: clientes?.length || 0
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
};