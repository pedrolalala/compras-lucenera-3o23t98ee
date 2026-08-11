import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { useCepLookup, useCnpjLookup } from '@/hooks/use-document-lookup'
import {
  criarFornecedor,
  atualizarFornecedor,
  getFornecedorPorCpfCnpj,
  type Fornecedor,
} from '@/services/fornecedores'

const schema = z.object({
  nome: z.string().min(1, 'Nome / Razão Social é obrigatório'),
  nome_empresa: z.string().optional(),
  cpf_cnpj: z.string().optional(),
  telefone: z.string().optional(),
  celular: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  cep: z.string().optional(),
  endereco: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  observacoes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const defaultValues: FormValues = {
  nome: '',
  nome_empresa: '',
  cpf_cnpj: '',
  telefone: '',
  celular: '',
  email: '',
  cep: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  observacoes: '',
}

function formatCnpj(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

/**
 * Modal de Cadastrar/Editar Fornecedor — não existia nenhum formulário de
 * fornecedor neste sistema (só vínculo com marca via busca de nome já
 * existente). Fornecedor é um registro em `contatos` + `contato_tipos`,
 * ver src/services/fornecedores.ts.
 */
export function FornecedorModal({
  open,
  onOpenChange,
  fornecedor,
  nomeInicial,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Presente = modo edição; ausente = criação. */
  fornecedor?: Fornecedor | null
  /** Pré-preenche o campo Nome ao abrir em modo criação (ex.: veio de uma busca sem resultado). */
  nomeInicial?: string
  onSuccess: (fornecedor: Fornecedor) => void
}) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { buscar: buscarCep, loading: loadingCep } = useCepLookup()
  const { buscar: buscarCnpj, loading: loadingCnpj } = useCnpjLookup()
  const numeroRef = useRef<HTMLInputElement>(null)
  const isEditing = !!fornecedor

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  useEffect(() => {
    if (!open) return
    if (fornecedor) {
      form.reset({
        nome: fornecedor.nome,
        nome_empresa: fornecedor.nome_empresa || '',
        cpf_cnpj: fornecedor.cpf_cnpj || '',
        telefone: fornecedor.telefone || '',
        celular: fornecedor.celular || '',
        email: fornecedor.email || '',
        cep: fornecedor.cep || '',
        endereco: fornecedor.endereco || '',
        numero: fornecedor.numero || '',
        complemento: fornecedor.complemento || '',
        bairro: fornecedor.bairro || '',
        cidade: fornecedor.cidade || '',
        estado: fornecedor.estado || '',
        observacoes: fornecedor.observacoes || '',
      })
    } else {
      form.reset({ ...defaultValues, nome: nomeInicial || '' })
    }
  }, [open, fornecedor, nomeInicial, form])

  const buscarEndereco = (cepValue: string) => {
    buscarCep(
      cepValue,
      (endereco) => {
        form.setValue('endereco', endereco.logradouro, { shouldDirty: true })
        form.setValue('bairro', endereco.bairro, { shouldDirty: true })
        form.setValue('cidade', endereco.cidade, { shouldDirty: true })
        form.setValue('estado', endereco.uf, { shouldDirty: true })
        numeroRef.current?.focus()
      },
      (message) => toast({ title: 'CEP', description: message }),
    )
  }

  const buscarEmpresa = (cnpjValue: string) => {
    buscarCnpj(
      cnpjValue,
      (dados) => {
        if (!form.getValues('nome')) {
          form.setValue('nome', dados.razaoSocial, { shouldDirty: true })
        }
        if (!form.getValues('nome_empresa')) {
          form.setValue('nome_empresa', dados.nomeFantasia, { shouldDirty: true })
        }
        if (dados.logradouro && !form.getValues('endereco')) {
          form.setValue('endereco', dados.logradouro, { shouldDirty: true })
        }
        if (dados.bairro && !form.getValues('bairro')) {
          form.setValue('bairro', dados.bairro, { shouldDirty: true })
        }
        if (dados.cidade && !form.getValues('cidade')) {
          form.setValue('cidade', dados.cidade, { shouldDirty: true })
        }
        if (dados.uf && !form.getValues('estado')) {
          form.setValue('estado', dados.uf, { shouldDirty: true })
        }
        if (dados.numero && !form.getValues('numero')) {
          form.setValue('numero', dados.numero, { shouldDirty: true })
        }
        if (dados.cep && !form.getValues('cep')) {
          form.setValue('cep', dados.cep, { shouldDirty: true })
        } else if (dados.cep && !dados.logradouro) {
          buscarEndereco(dados.cep)
        }
      },
      (message) => toast({ title: 'CNPJ', description: message }),
    )
  }

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true)
    try {
      if (values.cpf_cnpj) {
        const existente = await getFornecedorPorCpfCnpj(values.cpf_cnpj)
        if (existente && existente.id !== fornecedor?.id) {
          form.setError('cpf_cnpj', { message: 'Este CPF/CNPJ já está cadastrado' })
          toast({
            title: 'CPF/CNPJ já cadastrado',
            description: 'Já existe um contato com este documento.',
            variant: 'destructive',
          })
          setIsSubmitting(false)
          return
        }
      }

      const payload = {
        nome: values.nome,
        nome_empresa: values.nome_empresa || null,
        cpf_cnpj: values.cpf_cnpj || null,
        telefone: values.telefone || null,
        celular: values.celular || null,
        email: values.email || null,
        cep: values.cep || null,
        endereco: values.endereco || null,
        numero: values.numero || null,
        complemento: values.complemento || null,
        bairro: values.bairro || null,
        cidade: values.cidade || null,
        estado: values.estado?.toUpperCase() || null,
        observacoes: values.observacoes || null,
      }

      const resultado = isEditing
        ? await atualizarFornecedor(fornecedor!.id, payload)
        : await criarFornecedor(payload)

      toast({
        title: isEditing ? 'Fornecedor atualizado' : 'Fornecedor cadastrado',
        description: resultado.nome,
      })
      onSuccess(resultado)
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar fornecedor',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Fornecedor' : 'Cadastrar Fornecedor'}</DialogTitle>
          <DialogDescription>
            Preencha os dados abaixo. CEP e CNPJ buscam endereço e razão social automaticamente.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.stopPropagation()
              form.handleSubmit(onSubmit)(e)
            }}
            className="space-y-4"
          >
            <ScrollArea className="h-[55vh] px-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>
                        Nome / Razão Social <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Digite o nome..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cpf_cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        CNPJ
                        {loadingCnpj && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            Buscando...
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="00.000.000/0000-00"
                          {...field}
                          disabled={loadingCnpj}
                          onChange={(e) => {
                            const formatted = formatCnpj(e.target.value)
                            field.onChange(formatted)
                            buscarEmpresa(formatted)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nome_empresa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Fantasia</FormLabel>
                      <FormControl>
                        <Input placeholder="Opcional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone Fixo</FormLabel>
                      <FormControl>
                        <Input placeholder="Opcional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="celular"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Celular</FormLabel>
                      <FormControl>
                        <Input placeholder="Opcional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Opcional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="md:col-span-2 pt-2">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Endereço</h3>
                </div>
                <FormField
                  control={form.control}
                  name="cep"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        CEP
                        {loadingCep && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            Buscando...
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="00000-000"
                          maxLength={9}
                          {...field}
                          disabled={loadingCep}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, '')
                            const formatted = v.replace(/(\d{5})(\d)/, '$1-$2')
                            field.onChange(formatted)
                            buscarEndereco(formatted)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="numero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Opcional"
                          {...field}
                          ref={(el) => {
                            field.ref(el)
                            ;(numeroRef as React.MutableRefObject<HTMLInputElement | null>).current =
                              el
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endereco"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua, Av..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="complemento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input placeholder="Opcional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bairro"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro</FormLabel>
                      <FormControl>
                        <Input placeholder="Opcional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input placeholder="Opcional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="estado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="SP"
                          maxLength={2}
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="observacoes"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Notas adicionais..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
