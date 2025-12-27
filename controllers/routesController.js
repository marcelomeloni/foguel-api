// controllers/routesController.js

import { supabase } from '../services/supabaseService.js'
import jwt from 'jsonwebtoken'

// ➤ Criar Rota
export const createRota = async (req, res) => {
  try {
    const { colaborador_id, cliente_id, data_entrega, horario_previsto, produtos, observacoes } = req.body

    // 1. Antes de criar, descobrimos qual é a última sequência para este colaborador nesta data
    const { data: lastRoute, error: searchError } = await supabase
      .from('rotas')
      .select('sequence')
      .eq('colaborador_id', colaborador_id) // Filtra pelo entregador
      .eq('data_entrega', data_entrega)     // Filtra pela data (para reiniciar a contagem noutro dia)
      .order('sequence', { ascending: false }) // Pega o maior número
      .limit(1)

    if (searchError) {
        console.error('Erro ao buscar sequência', searchError)
        return res.status(400).json({ error: searchError })
    }

    // 2. Calculamos a nova sequência
    // Se não achou nada (primeira entrega do dia), começa em 1. Se achou, soma 1.
    const nextSequence = (lastRoute && lastRoute.length > 0) ? lastRoute[0].sequence + 1 : 1

    // 3. Inserimos com o campo sequence preenchido
    const { data, error } = await supabase
      .from('rotas')
      .insert([
        {
          colaborador_id,
          cliente_id,
          data_entrega,
          horario_previsto,
          produtos,
          observacoes,
          sequence: nextSequence // <--- CAMPO ADICIONADO AQUI
        }
      ])
      .select()

    if (error) return res.status(400).json({ error })
    return res.status(201).json(data[0])

  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Erro no servidor' })
  }
}

// ➤ Editar Rota
export const updateRota = async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const { data, error } = await supabase
      .from('rotas')
      .update(updates)
      .eq('id', id)
      .select()

    if (error) return res.status(400).json({ error })
    if (!data.length) return res.status(404).json({ error: 'Rota não encontrada' })

    return res.json(data[0])
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Erro no servidor' })
  }
}

// ➤ Deletar Rota
export const deleteRota = async (req, res) => {
  try {
    const { id } = req.params

    const { error } = await supabase
      .from('rotas')
      .delete()
      .eq('id', id)

    if (error) return res.status(400).json({ error })

    return res.json({ message: 'Rota apagada com sucesso!' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Erro no servidor' })
  }
}

// ➤ Listar todas as Rotas
export const getAllRotas = async (req, res) => {
  try {
    // 1. Busca as rotas
    const { data: rawData, error } = await supabase
      .from('rotas')
      .select(`
        *,
        colaboradores ( nome ),
        clientes ( nome, cidade )
      `)
      .order('data_entrega', { ascending: false });

    if (error) return res.status(400).json({ error });

    // 2. DATA DE HOJE (Fuso Horário BRASIL)
    // Usamos string YYYY-MM-DD para garantir que a comparação seja exata no Brasil
    const todayBrazil = new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());

    const future = [];
    const history = [];

    // 3. Processamento
    rawData.forEach((route) => {
      
      const formattedRoute = {
        ...route,
        motorista_nome: route.colaboradores?.nome || 'Sem Motorista',
        cliente_nome: route.clientes?.nome || 'Cliente Desconhecido',
        cidade: route.clientes?.cidade || '',
        items_count: Array.isArray(route.produtos) ? route.produtos.length : 0
      };

      // --- A CORREÇÃO MÁGICA ---
      // Uma rota é considerada "Concluída" se qualquer uma dessas for verdade:
      const isConcluido = 
          route.entregue === true ||             // 1. O booleano diz que entregou
          route.status === 'entregue' ||         // 2. O texto diz 'entregue'
          route.status === 'nao_entregue' ||     // 3. Tentou mas falhou (já foi processada)
          route.status === 'CONCLUIDO' ||        // 4. Status legado
          route.status === 'cancelado';          // 5. Cancelada

      // LÓGICA:
      // Se a data é Hoje ou Futuro (Brasil) ... E ... Não está concluída:
      // Vai para a lista de "A Fazer" (Future).
      // Se já foi concluída (mesmo que seja hoje), vai para o Histórico.
      if (route.data_entrega >= todayBrazil && !isConcluido) {
        future.push(formattedRoute);
      } else {
        history.push(formattedRoute);
      }
    });

    // 4. Reordena
    // Futuro: Do mais antigo para o mais novo (urgência)
    future.sort((a, b) => new Date(a.data_entrega) - new Date(b.data_entrega));
    
    // Histórico: Do mais recente para o mais antigo (log)
    // history.sort((a, b) => new Date(b.data_entrega) - new Date(a.data_entrega)); // Opcional

    return res.json({ future, history });

  } catch (error) {
    console.error('Erro no getAllRotas:', error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
}

// ➤ Listar rota específica
export const getRotaById = async (req, res) => {
  try {
    const { id } = req.params

    // AQUI ESTÁ A MÁGICA:
    // Selecionamos tudo da rota (*)
    // Trazemos os dados da tabela 'clientes' referenciada por 'cliente_id'
    // Trazemos os dados da tabela 'colaboradores' referenciada por 'colaborador_id'
    const { data, error } = await supabase
      .from('rotas')
      .select(`
        *,
        clientes:cliente_id (*), 
        colaboradores:colaborador_id (*)
      `)
      .eq('id', id)
      .single()

    if (error) return res.status(404).json({ error: 'Rota não encontrada' })

    return res.json(data)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Erro no servidor' })
  }
}

export const getRecentDeliveries = async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 4; // Padrão 4

    const { data, error } = await supabase
      .from('rotas')
      .select(`
        id, 
        data_entrega, 
        status, 
        entregue,
        clientes ( nome )
      `)
      // Filtra apenas o que foi finalizado (Entregue ou Falhou)
      .or('status.eq.entregue,status.eq.nao_entregue,entregue.eq.true,entregue.eq.false')
      .order('data_entrega', { ascending: false }) // Mais recentes primeiro
      .order('created_at', { ascending: false })   // Desempate por criação
      .limit(limit);

    if (error) return res.status(400).json({ error });

    // Formatação leve para o front
    const formatted = data.map(item => ({
      id: item.id,
      client: item.clientes?.nome || 'Cliente Desconhecido',
      date: item.data_entrega, // Pode formatar no front
      status: (item.entregue || item.status === 'entregue') ? 'delivered' : 'failed'
    }));

    return res.json(formatted);

  } catch (error) {
    console.error('Erro ao buscar entregas recentes:', error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
}
export const getAnalyticsReport = async (req, res) => {
  try {
    const { period } = req.query; // 'daily', 'weekly', 'monthly'

    let startDate = new Date();
    
    // Configura a data inicial baseada no filtro
    if (period === 'daily') {
      // Começo de hoje
      startDate.setHours(0,0,0,0);
    } else if (period === 'weekly') {
      // 7 dias atrás
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'monthly') {
      // 1º dia do mês atual
      startDate.setDate(1); 
      startDate.setHours(0,0,0,0);
    }

    // Formato ISO para o Supabase
    const isoDate = startDate.toISOString();

    const { data, error } = await supabase
      .from('rotas')
      .select(`
        id, data_entrega, status, entregue,
        clientes ( nome ),
        colaboradores ( nome )
      `)
      .gte('data_entrega', isoDate) // Greater Than or Equal (Maior ou igual à data)
      .order('data_entrega', { ascending: false });

    if (error) return res.status(400).json({ error });

    // Prepara o resumo para o PDF
    const summary = {
      period: period,
      total: data.length,
      delivered: data.filter(r => r.entregue || r.status === 'entregue').length,
      failed: data.filter(r => !r.entregue && r.status === 'nao_entregue').length,
      items: data.map(item => ({
        id: item.id,
        date: item.data_entrega,
        client: item.clientes?.nome || 'N/A',
        driver: item.colaboradores?.nome || 'N/A',
        status: (item.entregue || item.status === 'entregue') ? 'Sucesso' : 'Falha'
      }))
    };

    return res.json(summary);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }

}
