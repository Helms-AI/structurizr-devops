workspace "Q1 2026 Architecture" "Architecture workspace for Q1 2026" {

    !identifiers hierarchical

    model {
        !include model/people.dsl
        !include model/ecommerce-system.dsl
        !include model/external-systems.dsl
    }

    views {
        !include views/landscape.dsl
        !include views/context.dsl
        !include views/containers.dsl
        !include views/components.dsl
        !include styles/theme.dsl
    }

}
