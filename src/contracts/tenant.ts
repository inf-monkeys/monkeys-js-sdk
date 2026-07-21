import { z } from 'zod';
import {
  ContractIdentifierSchema,
  JsonObjectSchema,
  LocaleIdentifierSchema,
  LocalizedTextSchema,
} from './common';
import { PageDefinitionSchema } from './page';
import { ResolvedThemeTokensSchema } from './theme';

export const DesignTokenSourceSchema = z.string().trim().min(1).superRefine((source, context) => {
  if (/^[a-z][a-z\d+.-]*:/i.test(source) && !/^https?:\/\//i.test(source)) {
    context.addIssue({
      code: 'custom',
      message: 'Design token sources must be local file paths or HTTP(S) URLs.',
    });
  }
});

export const TenantDesignTokensConfigSchema = z
  .object({
    tokenSources: z.array(DesignTokenSourceSchema).min(1),
  })
  .strict();

/** Browser-safe reference to an authentication provider and its public policy. */
export const TenantAuthBindingSchema = z
  .object({
    kind: z.literal('auth-provider'),
    providerId: ContractIdentifierSchema,
    policyRef: ContractIdentifierSchema.optional(),
  })
  .strict();

/** Browser-safe reference to a data provider or an owned projection. */
export const TenantDataBindingSchema = z
  .discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('data-provider'),
        providerId: ContractIdentifierSchema,
        domainRef: ContractIdentifierSchema.optional(),
      })
      .strict(),
    z
      .object({
        kind: z.literal('projection'),
        projectionRef: ContractIdentifierSchema,
        domainRef: ContractIdentifierSchema.optional(),
      })
      .strict(),
  ]);

export const TenantAuthBindingsSchema = z.record(
  ContractIdentifierSchema,
  TenantAuthBindingSchema,
);

export const TenantDataBindingsSchema = z.record(
  ContractIdentifierSchema,
  TenantDataBindingSchema,
);

const AssetVariantsSchema = z
  .object({
    light: z.string().optional(),
    dark: z.string().optional(),
  })
  .strict();

const ThemeHeadbarSchema = z
  .object({
    theme: z.enum(['fixed', 'card', 'glassy', 'ghost', 'bsd-blue']).optional(),
    navPosition: z.enum(['left', 'center', 'right']).optional(),
    actions: z.union([z.literal('*'), z.array(ContractIdentifierSchema)]).optional(),
    profile: z.union([z.literal('*'), z.array(ContractIdentifierSchema)]).optional(),
    showTeamQuota: z.boolean().optional(),
  })
  .strict();

const KernelHeadbarSchema = z
  .object({
    theme: z.literal('card').optional(),
    layoutMode: z.enum(['boxed', 'full-bleed']).optional(),
    heightPx: z.number().positive().optional(),
    navPosition: z.enum(['left', 'center', 'right']).optional(),
    brandTitle: z.string().optional(),
    menuRadius: z.enum(['default', 'none', 'sm', 'md', 'lg', 'xl', 'full']).optional(),
  })
  .strict();

const CustomIconSchema = z
  .object({
    color: z.string().optional(),
    url: z.string().optional(),
    type: z.enum(['svg', 'image']).optional(),
    hintTextColor: z.string().optional(),
  })
  .strict();

const WorkbenchCustomerToolSchema = z.object({
  id: ContractIdentifierSchema,
  label: z.union([z.string(), z.record(LocaleIdentifierSchema, z.string())]).optional(),
  fixed: z.boolean().optional(),
}).strict();

const WorkbenchStudioOverrideSchema = z.object({
  studioName: z.string().trim().min(1),
  dropdownToolsDefault: z.array(ContractIdentifierSchema).optional(),
  existingToolsDefault: z.array(ContractIdentifierSchema).optional(),
  historyColumnsDefault: z.number().int().min(1).max(6).optional(),
}).strict();

export const TenantWorkbenchPageContextSchema = z
  .object({
    workflow: JsonObjectSchema.optional(),
    agent: JsonObjectSchema.optional(),
    agentId: ContractIdentifierSchema.optional(),
    designProject: JsonObjectSchema.optional(),
    designMetadataId: ContractIdentifierSchema.optional(),
    iframeUrl: z.string().trim().min(1).optional(),
    info: z
      .object({
        displayName: LocalizedTextSchema.optional(),
        description: LocalizedTextSchema.optional(),
        iconUrl: z.string().trim().min(1).optional(),
      })
      .strict()
      .optional(),
    isBuiltinPinned: z.boolean().optional(),
    isBuiltinReadonly: z.boolean().optional(),
  })
  .strict();

/**
 * Tenant-declared workbench pages use the same canonical declaration envelope
 * as server-owned pinned pages. Context is provider input only; renderer and
 * capability identity must live in the PageDefinition.
 */
export const TenantWorkbenchPageEnvelopeSchema = z
  .object({
    definition: PageDefinitionSchema,
    context: TenantWorkbenchPageContextSchema,
  })
  .strict()
  .superRefine(({ definition }, context) => {
    if (definition.surface !== 'view') {
      context.addIssue({
        code: 'custom',
        path: ['definition', 'surface'],
        message: 'Tenant workbench pages must render on the view surface.',
      });
    }
    if (!definition.ownership.builtIn) {
      context.addIssue({
        code: 'custom',
        path: ['definition', 'ownership', 'builtIn'],
        message: 'Tenant workbench pages must be declared as built-in pages.',
      });
    }
    if (!definition.navigation.pinned) {
      context.addIssue({
        code: 'custom',
        path: ['definition', 'navigation', 'pinned'],
        message: 'Tenant workbench pages must be pinned in workbench navigation.',
      });
    }
    if (!definition.visibility.productContexts.includes('studio')) {
      context.addIssue({
        code: 'custom',
        path: ['definition', 'visibility', 'productContexts'],
        message: 'Tenant workbench pages must include the studio product context.',
      });
    }
  });

export const TenantWorkbenchPageGroupSchema = z
  .object({
    id: ContractIdentifierSchema,
    pageIds: z.array(ContractIdentifierSchema),
    displayName: LocalizedTextSchema,
    isBuiltIn: z.boolean(),
    iconUrl: z.string().optional(),
    sortIndex: z.number().int().nullable().optional(),
    presetRelationId: ContractIdentifierSchema.optional(),
    relationKey: ContractIdentifierSchema.nullable().optional(),
    studioId: ContractIdentifierSchema.optional(),
  })
  .strict();

export const TenantWorkbenchConfigSchema = z.object({
  pages: z.array(TenantWorkbenchPageEnvelopeSchema),
  pageGroups: z.array(TenantWorkbenchPageGroupSchema),
  catalog: z.object({ enabled: z.boolean().optional(), defaultEntry: z.boolean().optional() }).strict().optional(),
  quickSwitcherMaxItems: z.number().int().nonnegative().optional(),
  defaultOrder: z.object({
    groups: z.array(ContractIdentifierSchema),
    pages: z.record(ContractIdentifierSchema, z.array(ContractIdentifierSchema)),
  }).strict().optional(),
  customers: z.object({
    dropdownToolsDefault: z.array(ContractIdentifierSchema).optional(),
    layoutManagerTools: z.array(WorkbenchCustomerToolSchema).optional(),
    studioTabsMode: z.enum(['dropdown', 'tabs']).optional(),
    historyWatermark: z.object({
      svgUrl: z.string().optional(),
      coverage: z.array(z.enum(['list', 'detail', 'download'])).optional(),
      maxLongEdgeRatio: z.number().positive().optional(),
      sizing: z.object({
        mode: ContractIdentifierSchema,
        heightRatio: z.number().positive().optional(),
        minHeightPx: z.number().nonnegative().optional(),
        maxHeightPx: z.number().nonnegative().optional(),
      }).strict().optional(),
      enhance: z.object({
        enabled: z.boolean().optional(),
        backgroundLumaThreshold: z.number().min(0).max(1).optional(),
        stroke: z.object({
          color: z.string().optional(), opacity: z.number().min(0).max(1).optional(), widthRatio: z.number().nonnegative().optional(), blurRatio: z.number().nonnegative().optional(), steps: z.number().int().positive().optional(),
        }).strict().optional(),
      }).strict().optional(),
    }).strict().optional(),
    layoutManagerEnabled: z.boolean().optional(),
    existingToolsDefault: z.array(ContractIdentifierSchema).optional(),
    historyColumnsDefault: z.number().int().min(1).max(6).optional(),
    studioOverrides: z.array(WorkbenchStudioOverrideSchema).optional(),
  }).strict().optional(),
}).strict().superRefine(({ pages, pageGroups }, context) => {
  const pageIds = pages.map(({ definition }) => definition.pageId);
  const pageIdSet = new Set(pageIds);
  if (pageIdSet.size !== pageIds.length) {
    context.addIssue({ code: 'custom', path: ['pages'], message: 'Tenant workbench page ids must be unique.' });
  }

  const groupIds = pageGroups.map(({ id }) => id);
  if (new Set(groupIds).size !== groupIds.length) {
    context.addIssue({ code: 'custom', path: ['pageGroups'], message: 'Tenant workbench page group ids must be unique.' });
  }

  pageGroups.forEach((group, groupIndex) => {
    group.pageIds.forEach((pageId, pageIndex) => {
      if (!pageIdSet.has(pageId)) {
        context.addIssue({
          code: 'custom',
          path: ['pageGroups', groupIndex, 'pageIds', pageIndex],
          message: `Tenant workbench page group references undeclared page ${pageId}.`,
        });
      }
    });
  });
});

const LoginPageSchema = z
  .object({
    background: z
      .object({ imageUrl: z.string().optional(), gradient: z.string().optional() })
      .strict()
      .optional(),
    logo: z
      .object({
        url: z.string().optional(),
        lightUrl: z.string().optional(),
        darkUrl: z.string().optional(),
        position: z.enum(['top', 'middle', 'bottom']).optional(),
        scale: z.number().positive().optional(),
      })
      .strict()
      .optional(),
    customCss: z.string().optional(),
  })
  .strict();

/** Public, application-specific values that are intentionally safe for browser clients. */
export const TenantApplicationConfigSchema = z
  .object({
    theme: z
      .object({
        id: z.string().optional(),
        name: z.string().optional(),
        title: z.string().optional(),
        favicon: AssetVariantsSchema.optional(),
        logo: AssetVariantsSchema.optional(),
        pwaIcon: z.string().optional(),
        form: z.object({ variant: z.enum(['bento', 'ghost']) }).strict().optional(),
        toast: z
          .object({
            position: z.enum(['top-right', 'top-left', 'bottom-right', 'bottom-left', 'top-center', 'bottom-center']),
          })
          .strict()
          .optional(),
        icons: z.object({ error: CustomIconSchema.optional(), empty: CustomIconSchema.optional() }).strict().optional(),
        views: z
          .object({
            form: z
              .object({
                toast: z.object({ afterCreate: z.boolean(), afterDelete: z.boolean() }).strict(),
                progress: z.enum(['estimate', 'infinite']),
                onlyResult: z.boolean(),
                tabular: z.object({ theme: z.enum(['default', 'tentiary', 'primary']) }).strict(),
              })
              .strict(),
          })
          .strict()
          .optional(),
        loginPage: LoginPageSchema.optional(),
        extraLanguageURL: z.record(z.string(), z.string()).optional(),
        hideSpaceHeader: z.boolean().optional(),
        showSidebarTeamSelector: z.boolean().optional(),
        showWorkbenchSidebar: z.boolean().optional(),
        workbenchViewTheme: z.enum(['default', 'bsd-blue']).optional(),
        defaults: z
          .object({
            showFormInImageDetail: z.boolean().optional(),
            darkMode: z.enum(['light', 'dark', 'auto']).optional(),
            language: z.enum(['en-US', 'zh-CN', 'ja-JP']).optional(),
            showDarkModeToggle: z.boolean().optional(),
            showLanguageToggle: z.boolean().optional(),
          })
          .strict()
          .optional(),
        modules: z
          .object({
            monkeysSpaceSidebar: z.union([z.literal('*'), z.array(ContractIdentifierSchema)]).optional(),
            monkeysSpaceHeadbar: z
              .union([
                z.literal('*'),
                z.array(
                  z
                    .object({
                      id: ContractIdentifierSchema,
                      extraInfo: z.boolean().optional(),
                      displayName: z.union([z.string(), z.record(LocaleIdentifierSchema, z.string())]).optional(),
                      visible: z.boolean().optional(),
                      disabled: z.boolean().optional(),
                      icon: z.string().optional(),
                      showQuickSwitcher: z.boolean().optional(),
                      showSidebar: z.boolean().optional(),
                    })
                    .strict(),
                ),
              ])
              .optional(),
            settingsSidebar: z.union([z.literal('*'), z.array(ContractIdentifierSchema)]).optional(),
          })
          .strict()
          .optional(),
        headbar: ThemeHeadbarSchema.optional(),
        kernelLayout: z
          .object({
            navigationMode: z.enum(['sidebar', 'topbar']).optional(),
            allowNavigationModeSwitch: z.boolean().optional(),
            headbar: KernelHeadbarSchema.optional(),
          })
          .strict()
          .optional(),
        paginationPosition: z.enum(['left', 'right']).optional(),
        ugcViewIconOnlyMode: z.boolean().optional(),
        workflowPreviewExecutionGrid: z
          .object({
            selectionModeDisplayType: z.enum(['operation-button', 'dropdown-menu']).optional(),
            clickBehavior: z.enum(['preview', 'select', 'fill-form']).optional(),
            showErrorFilter: z.boolean().optional(),
            displayType: z.enum(['grid', 'masonry']).optional(),
            showDetailButton: z.boolean().optional(),
          })
          .strict()
          .optional(),
        workbenchSidebarDefaultOpen: z.boolean().optional(),
        workbenchSidebarMoreAction: z.boolean().optional(),
        workbenchSidebarApart: z.boolean().optional(),
        workbenchSidebarToggleGroupDetail: z.boolean().optional(),
        workbenchSidebarViewType: z.boolean().optional(),
        workbenchSidebarFormViewEmbed: z.boolean().optional(),
        workbenchSidebarModernMode: z.boolean().optional(),
        ugc: z.object({ onItemClick: z.boolean(), subtitle: z.boolean().optional() }).strict().optional(),
        uniImagePreview: z.boolean().optional(),
        imagePreviewStyle: z.union([z.literal(false), z.enum(['simple', 'normal', 'uni'])]).optional(),
        teamAsUser: z.boolean().optional(),
        themeMode: z.enum(['shadow', 'border']).optional(),
        density: z.enum(['compact', 'default', 'comfortable']).optional(),
        pageZoom: z.number().positive().optional(),
        miniMode: z.object({ showPreviewViewExecutionResultGrid: z.boolean() }).strict().optional(),
        workflow: z.object({ allowConcurrentRuns: z.boolean() }).strict().optional(),
        historyResult: z.object({ display: z.boolean() }).strict().optional(),
        uploader: z
          .object({
            orientation: z.enum(['vertical', 'horizontal']),
            pasteButton: z.boolean(),
            statusText: z.boolean(),
          })
          .strict()
          .optional(),
        designProjects: z
          .object({
            oneOnOne: z.boolean(),
            newTabOpenBoard: z.boolean(),
            defaultShowGrid: z.boolean().optional(),
            createDefaultFrame: z.boolean(),
            showPageMenu: z.boolean(),
            showMainMenu: z.boolean(),
            showStylePanel: z.boolean(),
            showToolbar: z.boolean(),
            toolbarPosition: z.enum(['bottom', 'left']).optional(),
            showContextMenu: z.boolean(),
            showActionsMenu: z.boolean(),
            showPageAndLayerSidebar: z.boolean().optional(),
            showBoardOperationSidebar: z.boolean().optional(),
            showMiniToolsToolbar: z.boolean().optional(),
            showRightSidebar: z.boolean().optional(),
            showRealtimeDrawing: z.boolean().optional(),
            showWorkflow: z.boolean().optional(),
            showVersionManager: z.boolean().optional(),
            showAgent: z.boolean().optional(),
            AgentTools: z.array(ContractIdentifierSchema).optional(),
          })
          .strict()
          .optional(),
        workbench: TenantWorkbenchConfigSchema.optional(),
        visionProWorkflows: z.array(ContractIdentifierSchema).optional(),
        initTeam: z.boolean().optional(),
        imageThumbnail: z.boolean().optional(),
        pages: z
          .object({
            allowPageKeys: z.union([z.literal('*'), z.array(ContractIdentifierSchema)]),
            defaultPageKey: ContractIdentifierSchema.optional(),
          })
          .strict()
          .optional(),
        agent: z
          .object({
            brandDisplayMode: z.enum(['auto', 'logo-only', 'logo-name', 'name-only']).optional(),
            density: z.enum(['compact', 'default', 'comfortable']).optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    auth: z
      .object({
        enabled: z.array(ContractIdentifierSchema).default([]),
        oidc: z
          .object({ buttonText: z.string().optional(), autoSignin: z.boolean().optional() })
          .strict()
          .optional(),
        password: z
          .object({ disableAutoRegister: z.boolean().optional() })
          .strict()
          .optional(),
        hideAuthToast: z.boolean().optional(),
        autoReload: z.boolean().optional(),
        defaultOtherTeam: z.boolean().optional(),
      })
      .strict(),
    endpoints: z.record(ContractIdentifierSchema, z.string()),
    module: z.union([z.literal('*'), z.array(ContractIdentifierSchema)]),
    behavior: z
      .object({
        clearWorkflowFormStorageAfterUpdate: z.boolean().optional(),
        autoApproveOAuth: z.boolean().optional(),
        rememberWorkflowModelSelection: z.boolean().optional(),
      })
      .strict(),
    dataManagement: z
      .object({
        favoriteBucketId: z.string().optional(),
        pairedBucketId: z.string().optional(),
        galleryBucketId: z.string().optional(),
        dataBrowserDefaultBucketId: z.string().optional(),
        workflowResultBucketId: z.string().optional(),
        homeAdvertisement: z.object({
          bucketId: ContractIdentifierSchema, viewId: ContractIdentifierSchema.optional(), viewType: z.enum(['filter', 'container', 'share_link']).optional(), teamId: ContractIdentifierSchema.optional(), teamOnly: z.boolean().optional(), pageSize: z.number().int().positive().optional(), sortBy: z.enum(['pin_order', 'asset_id', 'updated_timestamp', 'created_timestamp']).optional(), sortOrder: z.enum(['asc', 'desc']).optional(), fieldMap: z.record(z.string(), z.string()).optional(), columnIds: z.record(z.string(), z.string()).optional(),
        }).strict().optional(),
        homeTrendAssistant: z.object({
          bucketId: ContractIdentifierSchema.optional(), viewId: ContractIdentifierSchema.optional(), viewInstanceId: ContractIdentifierSchema.optional(), viewName: z.string().optional(), teamId: ContractIdentifierSchema.optional(), designOptionsWorkflowId: ContractIdentifierSchema.optional(),
          tep: z.object({ baseUrl: z.string().optional(), timeoutMs: z.number().int().positive().optional() }).strict().optional(),
          runtime: z.object({ appId: ContractIdentifierSchema, tepBaseUrlConfigured: z.boolean(), tepAuthorizationConfigured: z.boolean(), tepCookieConfigured: z.boolean() }).strict().optional(),
        }).strict().optional(),
        sharing: z.object({
          silentViewLinks: z.object({ enabled: z.boolean().optional(), placement: z.object({ mode: z.enum(['sourceBucket', 'bucket']).optional(), bucketId: ContractIdentifierSchema.optional(), parentId: ContractIdentifierSchema.optional(), navId: ContractIdentifierSchema.optional() }).strict().optional() }).strict().optional(),
          shareAccess: z.object({ publicLinksEnabled: z.boolean().optional(), passwordGateEnabled: z.boolean().optional(), passwordAccessTtlSeconds: z.number().int().positive().optional(), defaultViewTreeDelivery: z.enum(['manual', 'auto']).optional() }).strict().optional(),
          shareDialog: z.object({
            audience: z.object({ enabled: z.boolean().optional(), allowed: z.array(z.enum(['user', 'team', 'public'])).optional(), default: z.enum(['user', 'team', 'public']).optional() }).strict().optional(),
            accessLevel: z.object({ enabled: z.boolean().optional(), allowed: z.array(z.enum(['read', 'write'])).optional(), default: z.enum(['read', 'write']).optional() }).strict().optional(),
            viewTreeDelivery: z.object({ enabled: z.boolean().optional(), allowed: z.array(z.enum(['manual', 'auto'])).optional(), default: z.enum(['manual', 'auto']).optional() }).strict().optional(),
          }).strict().optional(),
        }).strict().optional(),
      })
      .strict()
      .optional(),
    compute: z
      .object({
        integrations: z
          .object({
            harbor: z.object({ endpoint: z.string().optional(), projectScopes: z.array(z.string()).optional(), authMode: z.string().optional(), principal: z.string().optional(), autoSync: z.boolean().optional(), proxyUrl: z.string().optional() }).strict().optional(),
            gitlab: z.object({ baseUrl: z.string().optional(), groupScopes: z.array(z.string()).optional(), tokenMode: z.string().optional(), deployProjectPath: z.string().optional(), deploymentReportsEnabled: z.boolean().optional(), proxyUrl: z.string().optional() }).strict().optional(),
            kubernetes: z.object({ accessMode: z.string().optional(), clusterAlias: z.string().optional(), agentProjectPath: z.string().optional(), agentName: z.string().optional(), namespaceScopes: z.array(z.string()).optional(), rolloutObserverEnabled: z.boolean().optional(), proxyUrl: z.string().optional() }).strict().optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    data: z.object({}).strict().optional(),
    storage: z
      .object({
        presignMode: z.enum(['frontend', 'backend', 'both']).optional(),
        presign: z
          .object({
            expiresInSeconds: z.number().int().positive(),
            buckets: z.array(
              z
                .object({
                  id: ContractIdentifierSchema,
                  provider: ContractIdentifierSchema,
                  preferredUrlPatternId: ContractIdentifierSchema,
                  urlPatterns: z.array(
                    z
                      .object({
                        id: ContractIdentifierSchema,
                        type: z.enum(['bucket-hostname', 'provider-hostname']),
                        hostname: z.string().trim().min(1),
                        preferred: z.boolean().optional(),
                        bucketSegment: z.string().optional(),
                      })
                      .strict(),
                  ),
                })
                .strict(),
            ),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    monkeyData: z
      .object({ baseUrl: z.string().optional() })
      .strict()
      .optional(),
  })
  .strict();

export const TenantProductConfigSchema = z
  .object({
    contract: z.literal('TenantProductConfig'),
    tenantId: ContractIdentifierSchema,
    appId: ContractIdentifierSchema,
    environment: ContractIdentifierSchema,
    designTokens: TenantDesignTokensConfigSchema,
    moduleRefs: z.array(ContractIdentifierSchema).default([]),
    pageRefs: z.array(ContractIdentifierSchema).default([]),
    featureFlags: z.record(z.string(), z.boolean()).default({}),
    authBinding: TenantAuthBindingsSchema,
    dataBinding: TenantDataBindingsSchema,
    sourceMap: z.record(z.string(), ContractIdentifierSchema),
    warnings: z.array(z.string()).default([]),
    applicationConfig: TenantApplicationConfigSchema,
  })
  .strict();

/** Browser-safe projection. tokenSources and all other server-only values are structurally impossible here. */
export const TenantRuntimeConfigSchema = z
  .object({
    contract: z.literal('TenantRuntimeConfig'),
    tenantId: ContractIdentifierSchema,
    appId: ContractIdentifierSchema,
    environment: ContractIdentifierSchema,
    designTokens: ResolvedThemeTokensSchema,
    moduleRefs: z.array(ContractIdentifierSchema).default([]),
    pageRefs: z.array(ContractIdentifierSchema).default([]),
    featureFlags: z.record(z.string(), z.boolean()).default({}),
    authBinding: TenantAuthBindingsSchema,
    dataBinding: TenantDataBindingsSchema,
    sourceMap: z.record(z.string(), ContractIdentifierSchema),
    warnings: z.array(z.string()).default([]),
    applicationConfig: TenantApplicationConfigSchema,
  })
  .strict();

export type TenantProductConfig = z.infer<typeof TenantProductConfigSchema>;
export type TenantRuntimeConfig = z.infer<typeof TenantRuntimeConfigSchema>;
export type TenantApplicationConfig = z.infer<typeof TenantApplicationConfigSchema>;
export type TenantWorkbenchConfig = z.infer<typeof TenantWorkbenchConfigSchema>;
export type TenantWorkbenchPageContext = z.infer<typeof TenantWorkbenchPageContextSchema>;
export type TenantWorkbenchPageEnvelope = z.infer<typeof TenantWorkbenchPageEnvelopeSchema>;
export type TenantWorkbenchPageGroup = z.infer<typeof TenantWorkbenchPageGroupSchema>;
export type DesignTokenSource = z.infer<typeof DesignTokenSourceSchema>;
export type TenantDesignTokensConfig = z.infer<typeof TenantDesignTokensConfigSchema>;
export type TenantAuthBinding = z.infer<typeof TenantAuthBindingSchema>;
export type TenantDataBinding = z.infer<typeof TenantDataBindingSchema>;
